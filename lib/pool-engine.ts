import type {
  CharityAllocation,
  FourWayAllocation,
  PoolConfig,
  ReferralPayout,
  SplitAllocation,
} from "./types";

/** Split paise by percent; last destination absorbs remainder. */
export function splitPaiseByPercent(
  amountPaise: number,
  allocations: SplitAllocation[],
  names: Record<string, string>
): CharityAllocation[] {
  if (allocations.length === 0) {
    throw new Error("No charity split configured. Set destinations under Admin → Split.");
  }
  const totalPercent = allocations.reduce((s, a) => s + a.percent, 0);
  if (Math.abs(totalPercent - 100) > 0.001) {
    throw new Error(`Charity split must total 100% (currently ${totalPercent}%).`);
  }

  const results: CharityAllocation[] = [];
  let allocated = 0;
  allocations.forEach((alloc, index) => {
    const isLast = index === allocations.length - 1;
    const part = isLast
      ? amountPaise - allocated
      : (amountPaise * alloc.percent) / 100;
    if (!isLast) allocated += part;
    results.push({
      destinationId: alloc.destinationId,
      name: names[alloc.destinationId] ?? "Unknown",
      percent: alloc.percent,
      amountPaise: part,
    });
  });
  return results;
}

export function equalSplitPaise(
  totalPaise: number,
  recipientCount: number
): { shares: number[]; dust: number } {
  if (recipientCount <= 0) {
    return { shares: [], dust: totalPaise };
  }
  const share = totalPaise / recipientCount;
  return {
    shares: Array.from({ length: recipientCount }, () => share),
    dust: 0,
  };
}

export type EngineUser = {
  uid: string;
  referredBy: string | null;
  reinvestPaise: number;
  lifetimePaise: number;
  referralEarnPaise: number;
  tier: number;
  tierFeePaidPaise: number;
};

export type ProcessEntryInput = {
  amountPaise: number;
  userId: string;
  usersById: Record<string, EngineUser>;
  pool: PoolConfig;
  charityAllocations: SplitAllocation[];
  destinationNames: Record<string, string>;
};

export type ProcessEntryResult = {
  unitCount: number;
  fourWay: FourWayAllocation;
  charityAllocations: CharityAllocation[];
  referralPayouts: ReferralPayout[];
  userUpdates: Record<
    string,
    { reinvestPaise: number; lifetimePaise: number; referralEarnPaise: number }
  >;
  /** Referral earn credited as claimable voucher balance, by user. */
  voucherCredits: Record<string, number>;
  systemOpsDelta: number;
  systemCharityDelta: number;
  systemDustDelta: number;
};

function climbUpline(
  userId: string,
  usersById: Record<string, EngineUser>,
  depth: number
): string[] {
  const chain: string[] = [];
  let current = usersById[userId]?.referredBy ?? null;
  let level = 0;
  while (current && level < depth) {
    chain.push(current);
    current = usersById[current]?.referredBy ?? null;
    level += 1;
  }
  return chain;
}

/**
 * Process whole-rupee units through the 4-way pool protocol.
 * Remainder paise below unit size are rejected by caller (require whole rupees).
 */
export function processEntryUnits(input: ProcessEntryInput): ProcessEntryResult {
  const { amountPaise, userId, usersById, pool, charityAllocations, destinationNames } =
    input;
  const unit = pool.unitPaise;
  if (amountPaise < unit) {
    throw new Error(`Minimum entry is ₹${(unit / 100).toFixed(0)} (whole rupees).`);
  }
  if (amountPaise % unit !== 0) {
    throw new Error("Enter a whole-rupee amount (no paise fractions) for this POC.");
  }

  const unitCount = amountPaise / unit;
  const { ops, charity, reinvest, referral } = pool.splits;

  const opsPaise = ops * unitCount;
  const charityPaise = charity * unitCount;
  const reinvestPaise = reinvest * unitCount;
  const referralPaise = referral * unitCount;

  const referralPayouts: ReferralPayout[] = [];
  const earnDelta: Record<string, number> = {};

  const upline = climbUpline(userId, usersById, pool.referralDepth);
  const { shares, dust: dustPaise } = equalSplitPaise(
    referralPaise,
    upline.length
  );
  upline.forEach((uid, idx) => {
    const amount = shares[idx] ?? 0;
    if (amount <= 0) return;
    referralPayouts.push({ userId: uid, level: idx + 1, amountPaise: amount });
    earnDelta[uid] = (earnDelta[uid] ?? 0) + amount;
  });

  const charityParts = splitPaiseByPercent(
    charityPaise,
    charityAllocations,
    destinationNames
  );

  const actor = usersById[userId];
  if (!actor) throw new Error("User not found for entry.");

  const userUpdates: ProcessEntryResult["userUpdates"] = {
    [userId]: {
      reinvestPaise: actor.reinvestPaise + reinvestPaise,
      lifetimePaise: actor.lifetimePaise + amountPaise,
      referralEarnPaise: actor.referralEarnPaise,
    },
  };

  for (const [uid, delta] of Object.entries(earnDelta)) {
    const u = usersById[uid];
    if (!u) continue;
    const existing = userUpdates[uid];
    userUpdates[uid] = {
      reinvestPaise: existing?.reinvestPaise ?? u.reinvestPaise,
      lifetimePaise: existing?.lifetimePaise ?? u.lifetimePaise,
      referralEarnPaise: (existing?.referralEarnPaise ?? u.referralEarnPaise) + delta,
    };
  }

  return {
    unitCount,
    fourWay: { opsPaise, charityPaise, reinvestPaise, referralPaise, dustPaise },
    charityAllocations: charityParts,
    referralPayouts,
    userUpdates,
    voucherCredits: { ...earnDelta },
    systemOpsDelta: opsPaise,
    systemCharityDelta: charityPaise,
    systemDustDelta: dustPaise,
  };
}
