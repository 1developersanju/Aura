import { demoDb } from "./demo-db";
import { watchDemoSession as watchDemoSessionEvents } from "./demo-events";
import { isFirebaseConfigured } from "./firebase";
import { firebaseApi } from "./firebase-api";
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
  Voucher,
  Wallet,
} from "./types";

export type DataMode = "firebase" | "demo";

export function getDataMode(): DataMode {
  return isFirebaseConfigured() ? "firebase" : "demo";
}

type Api = {
  signUp(input: {
    email: string;
    password: string;
    displayName: string;
    referralCode?: string;
  }): Promise<AuraUser>;
  signIn(email: string, password: string): Promise<AuraUser>;
  signInWithGoogle?(referralCode?: string): Promise<AuraUser>;
  signOut(): Promise<void>;
  getUser(uid: string): Promise<AuraUser | null>;
  listUsers(): Promise<AuraUser[]>;
  promoteAdmin(email: string): Promise<AuraUser>;
  rebuildSpilloverTree(): Promise<{ updated: number }>;
  listDestinations(): Promise<Destination[]>;
  createDestination(input: { name: string; kind: DestinationKind }): Promise<Destination>;
  updateDestination(
    id: string,
    patch: Partial<Pick<Destination, "name" | "kind" | "active">>
  ): Promise<Destination>;
  getSplit(): Promise<SplitConfig>;
  saveSplit(allocations: SplitConfig["allocations"]): Promise<SplitConfig>;
  getProductConfig(): Promise<ProductConfig>;
  setProductMode(mode: ProductMode): Promise<ProductConfig>;
  getPoolConfig(): Promise<PoolConfig>;
  savePoolConfig(patch: Partial<PoolConfig>): Promise<PoolConfig>;
  listSystemWallets(): Promise<SystemWallet[]>;
  listEntries(): Promise<LedgerEntry[]>;
  listEntriesForUser(userId: string): Promise<LedgerEntry[]>;
  listVouchersForUser(userId: string): Promise<Voucher[]>;
  listAllVouchers(): Promise<Voucher[]>;
  redeemVoucher(voucherId: string, userId: string): Promise<Voucher>;
  createEntry(userId: string, amountRupees: number): Promise<LedgerEntry>;
  createDonation(userId: string, amount: number): Promise<Donation>;
  listDonationsForUser(userId: string): Promise<Donation[]>;
  listAllDonations(): Promise<Donation[]>;
  listWallets(): Promise<Wallet[]>;
  /** Zero all system + purpose wallet balances (ledger history kept). */
  resetWallets(): Promise<{ system: number; purpose: number }>;
  /**
   * Wipe transactional data: entries, vouchers, wallet balances, member earn stats.
   * Keeps accounts, destinations, split, and pool/product settings.
   */
  resetDatabase(): Promise<{
    entries: number;
    vouchers: number;
    usersReset: number;
    wallets: number;
  }>;
};

export function getApi(): Api {
  return getDataMode() === "firebase" ? firebaseApi : demoDb;
}

export function watchDemoSession(callback: (user: AuraUser | null) => void): () => void {
  const emit = () => callback(demoDb.getCurrentUser());
  emit();
  return watchDemoSessionEvents(emit);
}
