import { findSpilloverParent, rebuildSpilloverAssignments } from "./placement";
import { notifyDemoAuthChanged } from "./demo-events";
import { adminBootstrapEmail } from "./firebase";
import { generateReferralCode, normalizeReferralCode, uid } from "./ids";
import { paiseToRupees, rupeesToPaise } from "./paise";
import { defaultPoolConfig, defaultProductConfig, tierFromLifetime } from "./pool-config";
import { processEntryUnits, type EngineUser } from "./pool-engine";
import { sumPercents } from "./split";
import type {
  AuraUser,
  DemoAccount,
  Destination,
  DestinationKind,
  Donation,
  LedgerEntry,
  PoolConfig,
  ProductConfig,
  ProductMode,
  SplitConfig,
  SystemWallet,
  Voucher,
  Wallet,
} from "./types";

const STORAGE_KEY = "aura_demo_v2";

type DemoState = {
  accounts: DemoAccount[];
  sessionUid: string | null;
  destinations: Destination[];
  split: SplitConfig;
  wallets: Wallet[];
  referralIndex: Record<string, string>;
  product: ProductConfig;
  pool: PoolConfig;
  systemWallets: SystemWallet[];
  entries: LedgerEntry[];
  vouchers: Voucher[];
};

function emptyState(): DemoState {
  const now = new Date().toISOString();
  const education: Destination = {
    id: uid(),
    name: "Education",
    kind: "purpose",
    active: true,
    createdAt: now,
  };
  const food: Destination = {
    id: uid(),
    name: "Food relief",
    kind: "purpose",
    active: true,
    createdAt: now,
  };
  const partner: Destination = {
    id: uid(),
    name: "Partner Charity",
    kind: "charity",
    active: true,
    createdAt: now,
  };

  return {
    accounts: [],
    sessionUid: null,
    destinations: [education, food, partner],
    split: {
      version: 1,
      updatedAt: now,
      allocations: [
        { destinationId: education.id, percent: 40 },
        { destinationId: food.id, percent: 35 },
        { destinationId: partner.id, percent: 25 },
      ],
    },
    wallets: [
      { destinationId: education.id, balancePaise: 0, balance: 0, updatedAt: now },
      { destinationId: food.id, balancePaise: 0, balance: 0, updatedAt: now },
      { destinationId: partner.id, balancePaise: 0, balance: 0, updatedAt: now },
    ],
    referralIndex: {},
    product: defaultProductConfig(),
    pool: defaultPoolConfig(),
    systemWallets: [
      { id: "ops", balancePaise: 0, updatedAt: now },
      { id: "charity", balancePaise: 0, updatedAt: now },
      { id: "dust", balancePaise: 0, updatedAt: now },
    ],
    entries: [],
    vouchers: [],
  };
}

function normalizeUser(raw: Partial<AuraUser> & { uid: string; email: string }): AuraUser {
  return {
    uid: raw.uid,
    email: raw.email,
    displayName: raw.displayName ?? raw.email.split("@")[0]!,
    role: raw.role ?? "donor",
    referralCode: raw.referralCode ?? generateReferralCode(),
    referredBy: raw.referredBy ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    reinvestPaise: raw.reinvestPaise ?? 0,
    lifetimePaise: raw.lifetimePaise ?? 0,
    tier: raw.tier ?? 1,
    referralEarnPaise: raw.referralEarnPaise ?? 0,
  };
}

function read(): DemoState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = emptyState();
      write(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed.product) parsed.product = defaultProductConfig();
    if (!parsed.pool) parsed.pool = defaultPoolConfig();
    if (!parsed.systemWallets) {
      parsed.systemWallets = emptyState().systemWallets;
    }
    if (!parsed.entries) parsed.entries = [];
    if (!parsed.vouchers) parsed.vouchers = [];
    parsed.accounts = parsed.accounts.map((a) => ({
      ...normalizeUser(a),
      password: a.password,
    }));
    return parsed;
  } catch {
    const seeded = emptyState();
    write(seeded);
    return seeded;
  }
}

function write(state: DemoState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stripPassword(account: DemoAccount): AuraUser {
  const { password: _p, ...user } = account;
  return user;
}

function resolveRole(email: string): AuraUser["role"] {
  const bootstrap = adminBootstrapEmail();
  const normalized = email.toLowerCase();
  if (bootstrap && normalized === bootstrap) return "admin";
  if (normalized === "admin@aura.demo") return "admin";
  return "donor";
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

function bumpSystem(
  state: DemoState,
  id: SystemWallet["id"],
  delta: number,
  now: string
) {
  const w = state.systemWallets.find((x) => x.id === id);
  if (!w) {
    state.systemWallets.push({ id, balancePaise: delta, updatedAt: now });
  } else {
    w.balancePaise += delta;
    w.updatedAt = now;
  }
}

export const demoDb = {
  getSessionUid(): string | null {
    return read().sessionUid;
  },

  getCurrentUser(): AuraUser | null {
    const state = read();
    if (!state.sessionUid) return null;
    const account = state.accounts.find((a) => a.uid === state.sessionUid);
    return account ? stripPassword(account) : null;
  },

  async signUp(input: {
    email: string;
    password: string;
    displayName: string;
    referralCode?: string;
  }): Promise<AuraUser> {
    const state = read();
    const email = input.email.trim().toLowerCase();
    if (state.accounts.some((a) => a.email === email)) {
      throw new Error("An account with this email already exists.");
    }
    if (input.password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    if (input.referralCode?.trim()) {
      const code = normalizeReferralCode(input.referralCode);
      const inviterId = state.referralIndex[code];
      if (!inviterId) throw new Error("Invalid referral code.");
    }

    const role = resolveRole(email);
    // Admins stay outside the tree; donors fill the next sequential BFS slot.
    const referredBy =
      role === "admin"
        ? null
        : findSpilloverParent(
            state.accounts.map((a) => ({
              uid: a.uid,
              role: a.role,
              referredBy: a.referredBy,
              createdAt: a.createdAt,
            }))
          );

    let referralCode = generateReferralCode();
    while (state.referralIndex[referralCode]) {
      referralCode = generateReferralCode();
    }

    const account: DemoAccount = {
      ...normalizeUser({
        uid: uid(),
        email,
        displayName: input.displayName.trim() || email.split("@")[0]!,
        role,
        referralCode,
        referredBy,
      }),
      password: input.password,
    };

    state.accounts.push(account);
    state.referralIndex[referralCode] = account.uid;
    const sequential = rebuildSpilloverAssignments(
      state.accounts.map((a) => ({
        uid: a.uid,
        role: a.role,
        referredBy: a.referredBy,
        createdAt: a.createdAt,
      }))
    );
    for (const a of state.accounts) {
      a.referredBy = sequential.get(a.uid) ?? null;
    }
    state.sessionUid = account.uid;
    write(state);
    notifyDemoAuthChanged();
    return stripPassword(account);
  },

  async signIn(email: string, password: string): Promise<AuraUser> {
    const state = read();
    const normalized = email.trim().toLowerCase();
    const account = state.accounts.find((a) => a.email === normalized);
    if (!account || account.password !== password) {
      throw new Error("Invalid email or password.");
    }
    state.sessionUid = account.uid;
    write(state);
    notifyDemoAuthChanged();
    return stripPassword(account);
  },

  async signOut(): Promise<void> {
    const state = read();
    state.sessionUid = null;
    write(state);
    notifyDemoAuthChanged();
  },

  async getUser(uidValue: string): Promise<AuraUser | null> {
    const account = read().accounts.find((a) => a.uid === uidValue);
    return account ? stripPassword(account) : null;
  },

  async listUsers(): Promise<AuraUser[]> {
    return read().accounts.map(stripPassword);
  },

  async promoteAdmin(email: string): Promise<AuraUser> {
    const state = read();
    const normalized = email.trim().toLowerCase();
    const account = state.accounts.find((a) => a.email === normalized);
    if (!account) throw new Error("User not found.");
    account.role = "admin";
    account.referredBy = null;
    write(state);
    return stripPassword(account);
  },

  async rebuildSpilloverTree(): Promise<{ updated: number }> {
    const state = read();
    const assignments = rebuildSpilloverAssignments(
      state.accounts.map((a) => ({
        uid: a.uid,
        role: a.role,
        referredBy: a.referredBy,
        createdAt: a.createdAt,
      }))
    );
    let updated = 0;
    for (const account of state.accounts) {
      const next = assignments.get(account.uid) ?? null;
      if (account.referredBy !== next) {
        account.referredBy = next;
        updated += 1;
      }
    }
    write(state);
    return { updated };
  },

  async listDestinations(): Promise<Destination[]> {
    return [...read().destinations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async createDestination(input: {
    name: string;
    kind: DestinationKind;
  }): Promise<Destination> {
    const state = read();
    const now = new Date().toISOString();
    const dest: Destination = {
      id: uid(),
      name: input.name.trim(),
      kind: input.kind,
      active: true,
      createdAt: now,
    };
    state.destinations.push(dest);
    state.wallets.push({
      destinationId: dest.id,
      balancePaise: 0,
      balance: 0,
      updatedAt: now,
    });
    write(state);
    return dest;
  },

  async updateDestination(
    id: string,
    patch: Partial<Pick<Destination, "name" | "kind" | "active">>
  ): Promise<Destination> {
    const state = read();
    const dest = state.destinations.find((d) => d.id === id);
    if (!dest) throw new Error("Destination not found.");
    Object.assign(dest, patch);
    if (patch.active === false) {
      state.split.allocations = state.split.allocations.filter(
        (a) => a.destinationId !== id
      );
      state.split.version += 1;
      state.split.updatedAt = new Date().toISOString();
    }
    write(state);
    return dest;
  },

  async getSplit(): Promise<SplitConfig> {
    const s = read().split;
    return { ...s, allocations: [...s.allocations] };
  },

  async saveSplit(allocations: SplitConfig["allocations"]): Promise<SplitConfig> {
    const total = sumPercents(allocations);
    if (Math.abs(total - 100) > 0.001) {
      throw new Error(`Percentages must total 100% (got ${total}%).`);
    }
    const state = read();
    const activeIds = new Set(
      state.destinations.filter((d) => d.active).map((d) => d.id)
    );
    for (const a of allocations) {
      if (!activeIds.has(a.destinationId)) {
        throw new Error("Split includes an inactive or unknown destination.");
      }
      if (a.percent < 0) throw new Error("Percent cannot be negative.");
    }
    state.split = {
      version: state.split.version + 1,
      updatedAt: new Date().toISOString(),
      allocations: allocations.map((a) => ({
        destinationId: a.destinationId,
        percent: a.percent,
      })),
    };
    write(state);
    return state.split;
  },

  async getProductConfig(): Promise<ProductConfig> {
    return { ...read().product };
  },

  async setProductMode(mode: ProductMode): Promise<ProductConfig> {
    const state = read();
    state.product = { mode, updatedAt: new Date().toISOString() };
    write(state);
    return state.product;
  },

  async getPoolConfig(): Promise<PoolConfig> {
    return { ...read().pool, tiers: [...read().pool.tiers], splits: { ...read().pool.splits } };
  },

  async savePoolConfig(patch: Partial<PoolConfig>): Promise<PoolConfig> {
    const state = read();
    state.pool = {
      ...state.pool,
      ...patch,
      splits: { ...state.pool.splits, ...(patch.splits ?? {}) },
      tiers: patch.tiers ?? state.pool.tiers,
      updatedAt: new Date().toISOString(),
    };
    write(state);
    return state.pool;
  },

  async listSystemWallets(): Promise<SystemWallet[]> {
    return [...read().systemWallets];
  },

  async listEntries(): Promise<LedgerEntry[]> {
    return [...read().entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listEntriesForUser(userId: string): Promise<LedgerEntry[]> {
    return read()
      .entries.filter((e) => e.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listVouchersForUser(userId: string): Promise<Voucher[]> {
    return read()
      .vouchers.filter((v) => v.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listAllVouchers(): Promise<Voucher[]> {
    return [...read().vouchers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async redeemVoucher(voucherId: string, userId: string): Promise<Voucher> {
    const state = read();
    const v = state.vouchers.find((x) => x.id === voucherId);
    if (!v || v.userId !== userId) throw new Error("Voucher not found.");
    if (v.status !== "open") throw new Error("Voucher already redeemed.");
    v.status = "redeemed";
    v.redeemedAt = new Date().toISOString();
    write(state);
    return v;
  },

  async redeemOpenVouchers(
    userId: string
  ): Promise<{ count: number; valuePaise: number }> {
    const state = read();
    const now = new Date().toISOString();
    let count = 0;
    let valuePaise = 0;
    for (const v of state.vouchers) {
      if (v.userId !== userId || v.status !== "open") continue;
      v.status = "redeemed";
      v.redeemedAt = now;
      count += 1;
      valuePaise += v.valuePaise;
    }
    if (count === 0) throw new Error("No open voucher balance to redeem.");
    write(state);
    return { count, valuePaise };
  },

  async consolidateOpenVouchers(
    userId: string
  ): Promise<{ valuePaise: number; merged: number }> {
    const state = read();
    const open = state.vouchers
      .filter((v) => v.userId === userId && v.status === "open")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (open.length <= 1) {
      return { valuePaise: open[0]?.valuePaise ?? 0, merged: 0 };
    }
    const keeper = open[0]!;
    const extras = open.slice(1);
    const total = open.reduce((s, v) => s + v.valuePaise, 0);
    keeper.valuePaise = total;
    keeper.code = keeper.code.includes("_CREDIT")
      ? keeper.code
      : `${keeper.code.split("_")[0] ?? "AURA"}_CREDIT`;
    const drop = new Set(extras.map((v) => v.id));
    state.vouchers = state.vouchers.filter((v) => !drop.has(v.id));
    write(state);
    return { valuePaise: total, merged: extras.length };
  },

  async createEntry(userId: string, amountRupees: number): Promise<LedgerEntry> {
    const amountPaise = rupeesToPaise(amountRupees);
    const state = read();
    const actor = state.accounts.find((a) => a.uid === userId);
    if (!actor) throw new Error("User not found.");

    const usersById: Record<string, EngineUser> = {};
    for (const a of state.accounts) {
      usersById[a.uid] = {
        uid: a.uid,
        referredBy: a.referredBy,
        reinvestPaise: a.reinvestPaise,
        lifetimePaise: a.lifetimePaise,
        referralEarnPaise: a.referralEarnPaise,
      };
    }

    const names: Record<string, string> = {};
    for (const d of state.destinations) names[d.id] = d.name;
    const activeAllocations = state.split.allocations.filter((a) => {
      const dest = state.destinations.find((d) => d.id === a.destinationId);
      return dest?.active;
    });

    const result = processEntryUnits({
      amountPaise,
      userId,
      usersById,
      pool: state.pool,
      charityAllocations: activeAllocations,
      destinationNames: names,
    });

    const now = new Date().toISOString();
    const voucherIds: string[] = [];
    const addPaise = result.vouchersToSpawn * state.pool.unitPaise;
    if (addPaise > 0) {
      const open = state.vouchers.find(
        (v) => v.userId === userId && v.status === "open"
      );
      if (open) {
        open.valuePaise += addPaise;
        voucherIds.push(open.id);
      } else {
        const id = uid();
        state.vouchers.push({
          id,
          userId,
          code: `${actor.referralCode}_CREDIT`,
          valuePaise: addPaise,
          status: "open",
          createdAt: now,
          redeemedAt: null,
        });
        voucherIds.push(id);
      }
    }

    for (const [uidKey, upd] of Object.entries(result.userUpdates)) {
      const acc = state.accounts.find((a) => a.uid === uidKey);
      if (!acc) continue;
      acc.reinvestPaise = upd.reinvestPaise;
      acc.lifetimePaise = upd.lifetimePaise;
      acc.referralEarnPaise = upd.referralEarnPaise;
      acc.tier = tierFromLifetime(acc.lifetimePaise, state.pool.tiers);
    }

    bumpSystem(state, "ops", result.systemOpsDelta, now);
    bumpSystem(state, "charity", result.systemCharityDelta, now);
    bumpSystem(state, "dust", result.systemDustDelta, now);

    for (const alloc of result.charityAllocations) {
      let wallet = state.wallets.find((w) => w.destinationId === alloc.destinationId);
      if (!wallet) {
        wallet = {
          destinationId: alloc.destinationId,
          balancePaise: 0,
          balance: 0,
          updatedAt: now,
        };
        state.wallets.push(wallet);
      }
      wallet.balancePaise += alloc.amountPaise;
      wallet.balance = paiseToRupees(wallet.balancePaise);
      wallet.updatedAt = now;
    }

    const entry: LedgerEntry = {
      id: uid(),
      userId,
      amountPaise,
      mode: state.product.mode,
      createdAt: now,
      unitCount: result.unitCount,
      fourWay: result.fourWay,
      charityAllocations: result.charityAllocations,
      referralPayouts: result.referralPayouts,
      charitySplitVersion: state.split.version,
      vouchersSpawned: voucherIds,
    };
    state.entries.unshift(entry);
    write(state);
    notifyDemoAuthChanged();
    return entry;
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
    return read().wallets.map((w) => ({
      ...w,
      balance: paiseToRupees(w.balancePaise),
    }));
  },

  async resetWallets(): Promise<{ system: number; purpose: number }> {
    const state = read();
    const now = new Date().toISOString();
    for (const w of state.systemWallets) {
      w.balancePaise = 0;
      w.updatedAt = now;
    }
    for (const w of state.wallets) {
      w.balancePaise = 0;
      w.balance = 0;
      w.updatedAt = now;
    }
    write(state);
    return {
      system: state.systemWallets.length,
      purpose: state.wallets.length,
    };
  },

  async resetDatabase(): Promise<{
    entries: number;
    vouchers: number;
    usersReset: number;
    wallets: number;
  }> {
    const state = read();
    const now = new Date().toISOString();
    const entries = state.entries.length;
    const vouchers = state.vouchers.length;
    state.entries = [];
    state.vouchers = [];
    for (const w of state.systemWallets) {
      w.balancePaise = 0;
      w.updatedAt = now;
    }
    for (const w of state.wallets) {
      w.balancePaise = 0;
      w.balance = 0;
      w.updatedAt = now;
    }
    let usersReset = 0;
    for (const a of state.accounts) {
      if (a.role === "admin") continue;
      a.lifetimePaise = 0;
      a.reinvestPaise = 0;
      a.referralEarnPaise = 0;
      a.tier = 1;
      usersReset += 1;
    }
    write(state);
    return {
      entries,
      vouchers,
      usersReset,
      wallets: state.systemWallets.length + state.wallets.length,
    };
  },
};
