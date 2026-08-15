import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { findSpilloverParent, rebuildSpilloverAssignments } from "./placement";
import { adminBootstrapEmail, getFirebaseAuth, getFirestoreDb } from "./firebase";
import { generateReferralCode, normalizeReferralCode } from "./ids";
import { paiseToRupees, rupeesToPaise } from "./paise";
import {
  DEFAULT_TIERS,
  defaultPoolConfig,
  defaultProductConfig,
  tierFromReferralEarn,
} from "./pool-config";
import { processEntryUnits, type EngineUser } from "./pool-engine";
import { sumPercents } from "./split";
import type {
  AuraUser,
  Destination,
  DestinationKind,
  Donation,
  LedgerEntry,
  PoolConfig,
  ProductConfig,
  ProductMode,
  SplitConfig,
  SystemWallet,
  SystemWalletId,
  UserRole,
  Voucher,
  Wallet,
} from "./types";

function tsToIso(value: Timestamp | string | undefined): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  return value.toDate().toISOString();
}

function mapAuraUser(uid: string, data: Record<string, unknown>): AuraUser {
  return {
    uid,
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    role: data.role as UserRole,
    referralCode: String(data.referralCode ?? ""),
    referredBy: (data.referredBy as string | null) ?? null,
    createdAt: tsToIso(data.createdAt as Timestamp | string | undefined),
    reinvestPaise: typeof data.reinvestPaise === "number" ? data.reinvestPaise : 0,
    lifetimePaise: typeof data.lifetimePaise === "number" ? data.lifetimePaise : 0,
    referralEarnPaise:
      typeof data.referralEarnPaise === "number" ? data.referralEarnPaise : 0,
    tier: tierFromReferralEarn(
      typeof data.referralEarnPaise === "number" ? data.referralEarnPaise : 0,
      DEFAULT_TIERS
    ),
  };
}

function entryToDonation(entry: LedgerEntry): Donation {
  return {
    id: entry.id,
    userId: entry.userId,
    amount: paiseToRupees(entry.amountPaise),
    currency: "DEMO",
    createdAt: entry.createdAt,
    splitVersion: entry.charitySplitVersion,
    allocations: entry.charityAllocations.map((a) => ({
      destinationId: a.destinationId,
      name: a.name,
      percent: a.percent,
      amount: paiseToRupees(a.amountPaise),
    })),
  };
}

function mapLedgerEntry(id: string, data: Record<string, unknown>): LedgerEntry {
  return {
    id,
    userId: String(data.userId ?? ""),
    amountPaise: Number(data.amountPaise ?? 0),
    mode: data.mode as ProductMode,
    createdAt: tsToIso(data.createdAt as Timestamp | string | undefined),
    unitCount: Number(data.unitCount ?? 0),
    fourWay: data.fourWay as LedgerEntry["fourWay"],
    charityAllocations: (data.charityAllocations ?? []) as LedgerEntry["charityAllocations"],
    referralPayouts: (data.referralPayouts ?? []) as LedgerEntry["referralPayouts"],
    charitySplitVersion: Number(data.charitySplitVersion ?? 0),
    vouchersSpawned: (data.vouchersSpawned ?? []) as string[],
  };
}

function mapVoucher(id: string, data: Record<string, unknown>): Voucher {
  return {
    id,
    userId: String(data.userId ?? ""),
    code: String(data.code ?? ""),
    valuePaise: Number(data.valuePaise ?? 0),
    status: data.status as Voucher["status"],
    createdAt: tsToIso(data.createdAt as Timestamp | string | undefined),
    redeemedAt: data.redeemedAt
      ? tsToIso(data.redeemedAt as Timestamp | string)
      : null,
  };
}

async function uniqueReferralCode(): Promise<string> {
  const db = getFirestoreDb()!;
  for (let i = 0; i < 8; i++) {
    const code = generateReferralCode();
    const snap = await getDoc(doc(db, "referralCodes", code));
    if (!snap.exists()) return code;
  }
  throw new Error("Could not allocate referral code.");
}

function roleForEmail(email: string): UserRole {
  const bootstrap = adminBootstrapEmail();
  const normalized = email.toLowerCase();
  if (bootstrap && normalized === bootstrap) return "admin";
  if (normalized === "admin@aura.demo") return "admin";
  return "donor";
}

const PENDING_REF_KEY = "aura_pending_ref";

export function stashPendingReferral(code?: string) {
  if (typeof window === "undefined") return;
  if (code?.trim()) {
    sessionStorage.setItem(PENDING_REF_KEY, normalizeReferralCode(code));
  } else {
    sessionStorage.removeItem(PENDING_REF_KEY);
  }
}

function clearPendingReferral() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_REF_KEY);
}

async function applySequentialTree(): Promise<{
  assignments: Map<string, string | null>;
  updated: number;
}> {
  const db = getFirestoreDb()!;
  const snap = await getDocs(collection(db, "users"));
  const members = snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      role: (data.role as UserRole) ?? "donor",
      referredBy: (data.referredBy as string | null) ?? null,
      createdAt: tsToIso(data.createdAt),
    };
  });
  const assignments = rebuildSpilloverAssignments(members);
  let updated = 0;
  const batch = writeBatch(db);
  for (const d of snap.docs) {
    const next = assignments.get(d.id) ?? null;
    const prev = (d.data().referredBy as string | null) ?? null;
    if (prev !== next) {
      batch.update(d.ref, { referredBy: next });
      updated += 1;
    }
  }
  if (updated > 0) await batch.commit();
  return { assignments, updated };
}

export async function firebaseEnsureProfile(
  user: User,
  extras?: { displayName?: string; referralCode?: string }
): Promise<AuraUser> {
  const db = getFirestoreDb()!;
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    clearPendingReferral();
    return mapAuraUser(user.uid, existing.data() as Record<string, unknown>);
  }

  const explicitCode = extras?.referralCode?.trim();
  const pendingFromStorage =
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_REF_KEY) : null;
  const codeToUse = explicitCode || pendingFromStorage || undefined;

  if (codeToUse) {
    const code = normalizeReferralCode(codeToUse);
    const codeSnap = await getDoc(doc(db, "referralCodes", code));
    if (!codeSnap.exists()) {
      if (explicitCode) throw new Error("Invalid referral code.");
      console.warn("Invalid referral code ignored:", code);
    }
  }

  const email = (user.email ?? "").toLowerCase();
  const role = roleForEmail(email);

  let referredBy: string | null = null;
  if (role !== "admin") {
    const snap = await getDocs(collection(db, "users"));
    const members = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        role: (data.role as UserRole) ?? "donor",
        referredBy: (data.referredBy as string | null) ?? null,
        createdAt: tsToIso(data.createdAt),
      };
    });
    referredBy = findSpilloverParent(members);
  }

  const referralCode = await uniqueReferralCode();
  const profile: AuraUser = {
    uid: user.uid,
    email,
    displayName:
      extras?.displayName?.trim() ||
      user.displayName ||
      email.split("@")[0] ||
      "Donor",
    role,
    referralCode,
    referredBy,
    createdAt: new Date().toISOString(),
    reinvestPaise: 0,
    lifetimePaise: 0,
    tier: 1,
    referralEarnPaise: 0,
  };

  await setDoc(ref, {
    ...profile,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "referralCodes", referralCode), { userId: user.uid });
  const { assignments } = await applySequentialTree();
  if (assignments.has(user.uid)) {
    profile.referredBy = assignments.get(user.uid) ?? null;
  }
  clearPendingReferral();
  return profile;
}

export const firebaseApi = {
  async ensureSeeded(): Promise<void> {
    const db = getFirestoreDb()!;

    const productRef = doc(db, "config", "product");
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      const product = defaultProductConfig();
      await setDoc(productRef, {
        ...product,
        updatedAt: serverTimestamp(),
      });
    }

    const poolRef = doc(db, "config", "pool");
    const poolSnap = await getDoc(poolRef);
    if (!poolSnap.exists()) {
      const pool = defaultPoolConfig();
      await setDoc(poolRef, {
        ...pool,
        updatedAt: serverTimestamp(),
      });
    }

    for (const id of ["ops", "charity", "dust"] as SystemWalletId[]) {
      const walletRef = doc(db, "systemWallets", id);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) {
        await setDoc(walletRef, {
          id,
          balancePaise: 0,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const existing = await getDocs(collection(db, "destinations"));
    if (!existing.empty) return;

    const seeds: { name: string; kind: DestinationKind; percent: number }[] = [
      { name: "Education", kind: "purpose", percent: 40 },
      { name: "Food relief", kind: "purpose", percent: 35 },
      { name: "Partner Charity", kind: "charity", percent: 25 },
    ];

    const allocations: SplitConfig["allocations"] = [];
    for (const seed of seeds) {
      const ref = doc(collection(db, "destinations"));
      await setDoc(ref, {
        id: ref.id,
        name: seed.name,
        kind: seed.kind,
        active: true,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "wallets", ref.id), {
        destinationId: ref.id,
        balancePaise: 0,
        balance: 0,
        updatedAt: serverTimestamp(),
      });
      allocations.push({ destinationId: ref.id, percent: seed.percent });
    }

    await setDoc(doc(db, "config", "split"), {
      version: 1,
      updatedAt: serverTimestamp(),
      allocations,
    });
  },

  watchAuth(callback: (user: AuraUser | null) => void): () => void {
    const auth = getFirebaseAuth()!;
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }
      try {
        const profile = await firebaseEnsureProfile(fbUser);
        try {
          await firebaseApi.ensureSeeded();
        } catch (seedErr) {
          console.warn("Aura seed skipped:", seedErr);
        }
        callback(profile);
      } catch (err) {
        console.error("Aura auth profile error:", err);
        try {
          await firebaseSignOut(auth);
        } catch {
          /* ignore */
        }
        callback(null);
      }
    });
  },

  async signUp(input: {
    email: string;
    password: string;
    displayName: string;
    referralCode?: string;
  }): Promise<AuraUser> {
    const auth = getFirebaseAuth()!;
    const cred = await createUserWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password
    );
    return firebaseEnsureProfile(cred.user, {
      displayName: input.displayName,
      referralCode: input.referralCode,
    });
  },

  async signIn(email: string, password: string): Promise<AuraUser> {
    const auth = getFirebaseAuth()!;
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return firebaseEnsureProfile(cred.user);
  },

  async signInWithGoogle(referralCode?: string): Promise<AuraUser> {
    stashPendingReferral(referralCode);
    const auth = getFirebaseAuth()!;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const profile = await firebaseEnsureProfile(cred.user, {
      displayName: cred.user.displayName ?? undefined,
      referralCode,
    });
    try {
      await firebaseApi.ensureSeeded();
    } catch (seedErr) {
      console.warn("Aura seed skipped:", seedErr);
    }
    return profile;
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(getFirebaseAuth()!);
  },

  async getUser(uid: string): Promise<AuraUser | null> {
    const snap = await getDoc(doc(getFirestoreDb()!, "users", uid));
    if (!snap.exists()) return null;
    return mapAuraUser(uid, snap.data() as Record<string, unknown>);
  },

  async listUsers(): Promise<AuraUser[]> {
    const snap = await getDocs(collection(getFirestoreDb()!, "users"));
    return snap.docs.map((d) => mapAuraUser(d.id, d.data() as Record<string, unknown>));
  },

  async promoteAdmin(email: string): Promise<AuraUser> {
    const db = getFirestoreDb()!;
    const q = query(
      collection(db, "users"),
      where("email", "==", email.trim().toLowerCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("User not found.");
    const docRef = snap.docs[0]!;
    await updateDoc(docRef.ref, { role: "admin", referredBy: null });
    return mapAuraUser(docRef.id, {
      ...(docRef.data() as Record<string, unknown>),
      role: "admin",
      referredBy: null,
    });
  },

  async rebuildSpilloverTree(): Promise<{ updated: number }> {
    const { updated } = await applySequentialTree();
    return { updated };
  },

  async listDestinations(): Promise<Destination[]> {
    const snap = await getDocs(collection(getFirestoreDb()!, "destinations"));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          kind: data.kind,
          active: data.active,
          createdAt: tsToIso(data.createdAt),
        } satisfies Destination;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async createDestination(input: {
    name: string;
    kind: DestinationKind;
  }): Promise<Destination> {
    const db = getFirestoreDb()!;
    const ref = doc(collection(db, "destinations"));
    const dest: Destination = {
      id: ref.id,
      name: input.name.trim(),
      kind: input.kind,
      active: true,
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, { ...dest, createdAt: serverTimestamp() });
    await setDoc(doc(db, "wallets", ref.id), {
      destinationId: ref.id,
      balancePaise: 0,
      balance: 0,
      updatedAt: serverTimestamp(),
    });
    return dest;
  },

  async updateDestination(
    id: string,
    patch: Partial<Pick<Destination, "name" | "kind" | "active">>
  ): Promise<Destination> {
    const db = getFirestoreDb()!;
    const ref = doc(db, "destinations", id);
    await updateDoc(ref, patch);
    if (patch.active === false) {
      const splitRef = doc(db, "config", "split");
      const splitSnap = await getDoc(splitRef);
      if (splitSnap.exists()) {
        const data = splitSnap.data();
        const allocations = (
          data.allocations as SplitConfig["allocations"]
        ).filter((a) => a.destinationId !== id);
        await updateDoc(splitRef, {
          allocations,
          version: (data.version ?? 1) + 1,
          updatedAt: serverTimestamp(),
        });
      }
    }
    const snap = await getDoc(ref);
    const data = snap.data()!;
    return {
      id,
      name: data.name,
      kind: data.kind,
      active: data.active,
      createdAt: tsToIso(data.createdAt),
    };
  },

  async getSplit(): Promise<SplitConfig> {
    const snap = await getDoc(doc(getFirestoreDb()!, "config", "split"));
    if (!snap.exists()) {
      return { version: 0, updatedAt: new Date().toISOString(), allocations: [] };
    }
    const data = snap.data();
    return {
      version: data.version ?? 1,
      updatedAt: tsToIso(data.updatedAt),
      allocations: data.allocations ?? [],
    };
  },

  async saveSplit(allocations: SplitConfig["allocations"]): Promise<SplitConfig> {
    const total = sumPercents(allocations);
    if (Math.abs(total - 100) > 0.001) {
      throw new Error(`Percentages must total 100% (got ${total}%).`);
    }
    const db = getFirestoreDb()!;
    const ref = doc(db, "config", "split");
    const existing = await getDoc(ref);
    const version = (existing.exists() ? (existing.data().version ?? 0) : 0) + 1;
    const split: SplitConfig = {
      version,
      updatedAt: new Date().toISOString(),
      allocations,
    };
    await setDoc(ref, { ...split, updatedAt: serverTimestamp() }, { merge: true });
    return split;
  },

  async getProductConfig(): Promise<ProductConfig> {
    const snap = await getDoc(doc(getFirestoreDb()!, "config", "product"));
    if (!snap.exists()) return defaultProductConfig();
    const data = snap.data();
    return {
      mode: (data.mode as ProductMode) ?? "donations",
      updatedAt: tsToIso(data.updatedAt),
    };
  },

  async setProductMode(mode: ProductMode): Promise<ProductConfig> {
    const product: ProductConfig = {
      mode,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(
      doc(getFirestoreDb()!, "config", "product"),
      { ...product, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return product;
  },

  async getPoolConfig(): Promise<PoolConfig> {
    const snap = await getDoc(doc(getFirestoreDb()!, "config", "pool"));
    if (!snap.exists()) return defaultPoolConfig();
    const data = snap.data();
    const defaults = defaultPoolConfig();
    return {
      referralDepth: data.referralDepth ?? defaults.referralDepth,
      unitPaise: data.unitPaise ?? defaults.unitPaise,
      splits: { ...defaults.splits, ...(data.splits ?? {}) },
      tiers: data.tiers ?? defaults.tiers,
      updatedAt: tsToIso(data.updatedAt),
    };
  },

  async savePoolConfig(patch: Partial<PoolConfig>): Promise<PoolConfig> {
    const current = await this.getPoolConfig();
    const pool: PoolConfig = {
      ...current,
      ...patch,
      splits: { ...current.splits, ...(patch.splits ?? {}) },
      tiers: patch.tiers ?? current.tiers,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(
      doc(getFirestoreDb()!, "config", "pool"),
      { ...pool, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return pool;
  },

  async listSystemWallets(): Promise<SystemWallet[]> {
    const snap = await getDocs(collection(getFirestoreDb()!, "systemWallets"));
    const byId = new Map<SystemWalletId, SystemWallet>();
    for (const d of snap.docs) {
      const data = d.data();
      const id = (data.id ?? d.id) as SystemWalletId;
      byId.set(id, {
        id,
        balancePaise: Number(data.balancePaise ?? 0),
        updatedAt: tsToIso(data.updatedAt),
      });
    }
    return (["ops", "charity", "dust"] as SystemWalletId[]).map(
      (id) =>
        byId.get(id) ?? {
          id,
          balancePaise: 0,
          updatedAt: new Date().toISOString(),
        }
    );
  },

  async listEntries(): Promise<LedgerEntry[]> {
    const snap = await getDocs(collection(getFirestoreDb()!, "entries"));
    return snap.docs
      .map((d) => mapLedgerEntry(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listEntriesForUser(userId: string): Promise<LedgerEntry[]> {
    const q = query(
      collection(getFirestoreDb()!, "entries"),
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapLedgerEntry(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listVouchersForUser(userId: string): Promise<Voucher[]> {
    const q = query(
      collection(getFirestoreDb()!, "vouchers"),
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapVoucher(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listAllVouchers(): Promise<Voucher[]> {
    const snap = await getDocs(collection(getFirestoreDb()!, "vouchers"));
    return snap.docs
      .map((d) => mapVoucher(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async redeemVoucher(voucherId: string, userId: string): Promise<Voucher> {
    const db = getFirestoreDb()!;
    const ref = doc(db, "vouchers", voucherId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Voucher not found.");
    const data = snap.data();
    if (data.userId !== userId) throw new Error("Voucher not found.");
    if (data.status !== "open") throw new Error("Voucher already redeemed.");
    const redeemedAt = new Date().toISOString();
    await updateDoc(ref, {
      status: "redeemed",
      redeemedAt: serverTimestamp(),
    });
    return mapVoucher(voucherId, {
      ...(data as Record<string, unknown>),
      status: "redeemed",
      redeemedAt,
    });
  },

  async redeemOpenVouchers(
    userId: string
  ): Promise<{ count: number; valuePaise: number }> {
    const db = getFirestoreDb()!;
    const open = (await this.listVouchersForUser(userId)).filter(
      (v) => v.status === "open"
    );
    if (open.length === 0) throw new Error("No open voucher balance to redeem.");
    const batch = writeBatch(db);
    let valuePaise = 0;
    for (const v of open) {
      valuePaise += v.valuePaise;
      batch.update(doc(db, "vouchers", v.id), {
        status: "redeemed",
        redeemedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return { count: open.length, valuePaise };
  },

  async consolidateOpenVouchers(
    userId: string
  ): Promise<{ valuePaise: number; merged: number }> {
    const db = getFirestoreDb()!;
    const open = (await this.listVouchersForUser(userId))
      .filter((v) => v.status === "open")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (open.length <= 1) {
      return { valuePaise: open[0]?.valuePaise ?? 0, merged: 0 };
    }
    const keeper = open[0]!;
    const extras = open.slice(1);
    const total = open.reduce((s, v) => s + v.valuePaise, 0);
    const batch = writeBatch(db);
    const code = keeper.code.includes("_CREDIT")
      ? keeper.code
      : `${keeper.code.split("_")[0] ?? "AURA"}_CREDIT`;
    batch.update(doc(db, "vouchers", keeper.id), {
      valuePaise: total,
      code,
    });
    for (const v of extras) {
      batch.delete(doc(db, "vouchers", v.id));
    }
    await batch.commit();
    return { valuePaise: total, merged: extras.length };
  },

  async createEntry(userId: string, amountRupees: number): Promise<LedgerEntry> {
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      throw new Error("Enter a positive entry amount.");
    }

    const db = getFirestoreDb()!;
    const amountPaise = rupeesToPaise(amountRupees);

    const usersSnap = await getDocs(collection(db, "users"));
    const usersById: Record<string, EngineUser> = {};
    const referralCodes: Record<string, string> = {};
    for (const d of usersSnap.docs) {
      const mapped = mapAuraUser(d.id, d.data() as Record<string, unknown>);
      usersById[d.id] = {
        uid: mapped.uid,
        referredBy: mapped.referredBy,
        reinvestPaise: mapped.reinvestPaise,
        lifetimePaise: mapped.lifetimePaise,
        referralEarnPaise: mapped.referralEarnPaise,
      };
      referralCodes[d.id] = mapped.referralCode;
    }
    if (!usersById[userId]) throw new Error("User not found.");

    const [pool, product, split, destinations] = await Promise.all([
      this.getPoolConfig(),
      this.getProductConfig(),
      this.getSplit(),
      this.listDestinations(),
    ]);

    const names: Record<string, string> = {};
    for (const d of destinations) names[d.id] = d.name;
    const activeIds = new Set(destinations.filter((d) => d.active).map((d) => d.id));
    const activeAllocations = split.allocations.filter((a) =>
      activeIds.has(a.destinationId)
    );

    const result = processEntryUnits({
      amountPaise,
      userId,
      usersById,
      pool,
      charityAllocations: activeAllocations,
      destinationNames: names,
    });

    const existingVouchers = await this.listAllVouchers();
    const nowIso = new Date().toISOString();
    const entryRef = doc(collection(db, "entries"));
    const voucherIds: string[] = [];

    const batch = writeBatch(db);

    for (const [uid, addPaise] of Object.entries(result.voucherCredits)) {
      if (addPaise <= 0) continue;
      const open = existingVouchers.find(
        (v) => v.userId === uid && v.status === "open"
      );
      if (open) {
        voucherIds.push(open.id);
        batch.update(doc(db, "vouchers", open.id), {
          valuePaise: increment(addPaise),
        });
      } else {
        const voucherRef = doc(collection(db, "vouchers"));
        voucherIds.push(voucherRef.id);
        batch.set(voucherRef, {
          userId: uid,
          code: `${referralCodes[uid] ?? "REF"}_CREDIT`,
          valuePaise: addPaise,
          status: "open",
          createdAt: serverTimestamp(),
          redeemedAt: null,
        });
      }
    }

    batch.set(entryRef, {
      userId,
      amountPaise,
      mode: product.mode,
      createdAt: serverTimestamp(),
      unitCount: result.unitCount,
      fourWay: result.fourWay,
      charityAllocations: result.charityAllocations,
      referralPayouts: result.referralPayouts,
      charitySplitVersion: split.version,
      vouchersSpawned: voucherIds,
    });

    for (const [uidKey, upd] of Object.entries(result.userUpdates)) {
      batch.update(doc(db, "users", uidKey), {
        reinvestPaise: upd.reinvestPaise,
        lifetimePaise: upd.lifetimePaise,
        referralEarnPaise: upd.referralEarnPaise,
        tier: tierFromReferralEarn(upd.referralEarnPaise, pool.tiers),
      });
    }

    for (const id of ["ops", "charity", "dust"] as SystemWalletId[]) {
      const delta =
        id === "ops"
          ? result.systemOpsDelta
          : id === "charity"
            ? result.systemCharityDelta
            : result.systemDustDelta;
      if (delta === 0) continue;
      const walletRef = doc(db, "systemWallets", id);
      batch.set(
        walletRef,
        {
          id,
          balancePaise: increment(delta),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    for (const alloc of result.charityAllocations) {
      if (alloc.amountPaise === 0) continue;
      const walletRef = doc(db, "wallets", alloc.destinationId);
      batch.set(
        walletRef,
        {
          destinationId: alloc.destinationId,
          balancePaise: increment(alloc.amountPaise),
          balance: increment(paiseToRupees(alloc.amountPaise)),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    return {
      id: entryRef.id,
      userId,
      amountPaise,
      mode: product.mode,
      createdAt: nowIso,
      unitCount: result.unitCount,
      fourWay: result.fourWay,
      charityAllocations: result.charityAllocations,
      referralPayouts: result.referralPayouts,
      charitySplitVersion: split.version,
      vouchersSpawned: voucherIds,
    };
  },

  async createDonation(userId: string, amount: number): Promise<Donation> {
    const entry = await this.createEntry(userId, amount);
    return entryToDonation(entry);
  },

  async listDonationsForUser(userId: string): Promise<Donation[]> {
    return (await this.listEntriesForUser(userId)).map(entryToDonation);
  },

  async listAllDonations(): Promise<Donation[]> {
    return (await this.listEntries()).map(entryToDonation);
  },

  async listWallets(): Promise<Wallet[]> {
    const snap = await getDocs(collection(getFirestoreDb()!, "wallets"));
    return snap.docs.map((d) => {
      const data = d.data();
      const balancePaise =
        typeof data.balancePaise === "number"
          ? data.balancePaise
          : Math.round(Number(data.balance ?? 0) * 100);
      return {
        destinationId: d.id,
        balancePaise,
        balance: paiseToRupees(balancePaise),
        updatedAt: tsToIso(data.updatedAt),
      };
    });
  },

  async resetWallets(): Promise<{ system: number; purpose: number }> {
    const db = getFirestoreDb()!;
    const batch = writeBatch(db);
    for (const id of ["ops", "charity", "dust"] as SystemWalletId[]) {
      batch.set(
        doc(db, "systemWallets", id),
        { id, balancePaise: 0, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    const wallets = await getDocs(collection(db, "wallets"));
    for (const d of wallets.docs) {
      batch.set(
        d.ref,
        { balancePaise: 0, balance: 0, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
    return { system: 3, purpose: wallets.size };
  },

  async resetDatabase(): Promise<{
    entries: number;
    vouchers: number;
    usersReset: number;
    wallets: number;
  }> {
    const db = getFirestoreDb()!;

    async function commitInChunks(
      refs: ReturnType<typeof doc>[],
      apply: (batch: ReturnType<typeof writeBatch>, ref: ReturnType<typeof doc>) => void
    ) {
      const CHUNK = 400;
      for (let i = 0; i < refs.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const ref of refs.slice(i, i + CHUNK)) apply(batch, ref);
        await batch.commit();
      }
    }

    const [entriesSnap, vouchersSnap, walletsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "entries")),
      getDocs(collection(db, "vouchers")),
      getDocs(collection(db, "wallets")),
      getDocs(collection(db, "users")),
    ]);

    await commitInChunks(
      entriesSnap.docs.map((d) => d.ref),
      (batch, ref) => batch.delete(ref)
    );
    await commitInChunks(
      vouchersSnap.docs.map((d) => d.ref),
      (batch, ref) => batch.delete(ref)
    );

    const walletRefs = [
      ...(["ops", "charity", "dust"] as SystemWalletId[]).map((id) =>
        doc(db, "systemWallets", id)
      ),
      ...walletsSnap.docs.map((d) => d.ref),
    ];
    await commitInChunks(walletRefs, (batch, ref) => {
      const isSystem = ref.path.startsWith("systemWallets/");
      batch.set(
        ref,
        isSystem
          ? {
              id: ref.id as SystemWalletId,
              balancePaise: 0,
              updatedAt: serverTimestamp(),
            }
          : { balancePaise: 0, balance: 0, updatedAt: serverTimestamp() },
        { merge: true }
      );
    });

    const donors = usersSnap.docs.filter((d) => {
      const role = (d.data().role as string) ?? "donor";
      return role !== "admin";
    });
    await commitInChunks(
      donors.map((d) => d.ref),
      (batch, ref) =>
        batch.update(ref, {
          lifetimePaise: 0,
          reinvestPaise: 0,
          referralEarnPaise: 0,
          tier: 1,
        })
    );

    return {
      entries: entriesSnap.size,
      vouchers: vouchersSnap.size,
      usersReset: donors.length,
      wallets: 3 + walletsSnap.size,
    };
  },
};
