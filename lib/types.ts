export type UserRole = "donor" | "admin";
export type DestinationKind = "purpose" | "charity";
export type ProductMode = "donations" | "supermarket";
export type VoucherStatus = "open" | "redeemed";

export type AuraUser = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  referralCode: string;
  referredBy: string | null;
  createdAt: string;
  reinvestPaise: number;
  lifetimePaise: number;
  tier: number;
  referralEarnPaise: number;
  /** Upgrade fees already taken from referral earn (legacy settle uses this). */
  tierFeePaidPaise: number;
};

export type Destination = {
  id: string;
  name: string;
  kind: DestinationKind;
  active: boolean;
  createdAt: string;
};

export type SplitAllocation = {
  destinationId: string;
  percent: number;
};

export type SplitConfig = {
  version: number;
  updatedAt: string;
  allocations: SplitAllocation[];
};

export type CharityAllocation = {
  destinationId: string;
  name: string;
  percent: number;
  amountPaise: number;
};

/** Legacy donation shape (rupees) — kept for UI compatibility wrappers. */
export type DonationAllocation = {
  destinationId: string;
  name: string;
  percent: number;
  amount: number;
};

export type Donation = {
  id: string;
  userId: string;
  amount: number;
  currency: "DEMO";
  createdAt: string;
  splitVersion: number;
  allocations: DonationAllocation[];
};

export type Wallet = {
  destinationId: string;
  balancePaise: number;
  /** @deprecated use balancePaise; rupee float for old UI */
  balance: number;
  updatedAt: string;
};

export type SystemWalletId = "ops" | "charity" | "dust";

export type SystemWallet = {
  id: SystemWalletId;
  balancePaise: number;
  updatedAt: string;
};

export type PoolSplits = {
  ops: number;
  charity: number;
  reinvest: number;
  referral: number;
};

export type TierThreshold = {
  tier: number;
  name: string;
  minPaise: number;
};

export type PoolConfig = {
  referralDepth: number;
  unitPaise: number;
  splits: PoolSplits;
  tiers: TierThreshold[];
  updatedAt: string;
};

export type ProductConfig = {
  mode: ProductMode;
  updatedAt: string;
};

export type ReferralPayout = {
  userId: string;
  level: number;
  amountPaise: number;
};

export type FourWayAllocation = {
  opsPaise: number;
  charityPaise: number;
  reinvestPaise: number;
  referralPaise: number;
  dustPaise: number;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  amountPaise: number;
  mode: ProductMode;
  createdAt: string;
  unitCount: number;
  fourWay: FourWayAllocation;
  charityAllocations: CharityAllocation[];
  referralPayouts: ReferralPayout[];
  charitySplitVersion: number;
  vouchersSpawned: string[];
};

export type Voucher = {
  id: string;
  userId: string;
  code: string;
  valuePaise: number;
  status: VoucherStatus;
  createdAt: string;
  redeemedAt: string | null;
};

export type DemoAccount = AuraUser & {
  password: string;
};
