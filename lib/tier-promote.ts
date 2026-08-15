import { processEntryUnits, type EngineUser, type ProcessEntryResult } from "./pool-engine";
import { tierFromReferralEarn } from "./pool-config";
import type { PoolConfig, SplitAllocation } from "./types";

export type RankedUser = EngineUser & { tier: number };

export type TierPromotion = {
  userId: string;
  fromTier: number;
  toTier: number;
  costPaise: number;
  result: ProcessEntryResult;
};

function nextUnpaidTier(
  paidPaise: number,
  pool: PoolConfig
): { tier: number; minPaise: number } | null {
  const earned = tierFromFeesPaid(paidPaise, pool);
  const next = [...pool.tiers]
    .sort((a, b) => a.tier - b.tier)
    .find((t) => t.tier === earned + 1);
  return next ? { tier: next.tier, minPaise: next.minPaise } : null;
}

function syncDisplayTier(user: RankedUser, pool: PoolConfig) {
  user.tier = tierFromReferralEarn(user.referralEarnPaise, pool.tiers);
}

function mergeUpdates(
  usersById: Record<string, RankedUser>,
  updates: ProcessEntryResult["userUpdates"]
) {
  for (const [id, upd] of Object.entries(updates)) {
    const prev = usersById[id];
    if (!prev) continue;
    usersById[id] = { ...prev, ...upd };
  }
}

/**
 * Charge the next unpaid fee when leftover earn covers it, for every
 * tier (Silver → Platinum). The badge is leftover earn vs all
 * thresholds, so paying Gold then dropping below ₹1,000 is Starter or
 * Silver — not a frozen Gold. Already-paid fees are not charged twice.
 */
export function runReferralTierPromotions(input: {
  usersById: Record<string, RankedUser>;
  seedUserIds: string[];
  pool: PoolConfig;
  charityAllocations: SplitAllocation[];
  destinationNames: Record<string, string>;
  maxPromotions?: number;
}): {
  usersById: Record<string, RankedUser>;
  promotions: TierPromotion[];
  voucherDebits: Record<string, number>;
} {
  const usersById = input.usersById;
  const promotions: TierPromotion[] = [];
  const voucherDebits: Record<string, number> = {};
  const queue = [...new Set(input.seedUserIds)];
  const enqueued = new Set(queue);
  const cap = input.maxPromotions ?? 25;

  while (queue.length > 0 && promotions.length < cap) {
    const userId = queue.shift()!;

    while (promotions.length < cap) {
      const user = usersById[userId];
      if (!user) break;
      const next = nextUnpaidTier(user.tierFeePaidPaise, input.pool);
      if (!next || user.referralEarnPaise < next.minPaise) break;

      const fromTier = tierFromReferralEarn(
        user.referralEarnPaise,
        input.pool.tiers
      );
      user.referralEarnPaise -= next.minPaise;
      voucherDebits[userId] = (voucherDebits[userId] ?? 0) + next.minPaise;

      const result = processEntryUnits({
        amountPaise: next.minPaise,
        userId,
        usersById,
        pool: input.pool,
        charityAllocations: input.charityAllocations,
        destinationNames: input.destinationNames,
      });
      mergeUpdates(usersById, result.userUpdates);
      usersById[userId]!.tierFeePaidPaise += next.minPaise;
      syncDisplayTier(usersById[userId]!, input.pool);

      promotions.push({
        userId,
        fromTier,
        toTier: usersById[userId]!.tier,
        costPaise: next.minPaise,
        result,
      });

      for (const uid of Object.keys(result.voucherCredits)) {
        if (!enqueued.has(uid)) {
          enqueued.add(uid);
          queue.push(uid);
        }
      }
    }
  }

  for (const user of Object.values(usersById)) {
    syncDisplayTier(user, input.pool);
  }

  return { usersById, promotions, voucherDebits };
}

export function netVoucherDelta(
  credits: Record<string, number>[],
  debits: Record<string, number>
): Record<string, number> {
  const net: Record<string, number> = {};
  for (const bag of credits) {
    for (const [uid, n] of Object.entries(bag)) {
      net[uid] = (net[uid] ?? 0) + n;
    }
  }
  for (const [uid, n] of Object.entries(debits)) {
    net[uid] = (net[uid] ?? 0) - n;
  }
  return net;
}

/** Highest tier fully paid for by recorded upgrade fees. */
export function tierFromFeesPaid(paidPaise: number, pool: PoolConfig): number {
  let tier = 1;
  let used = 0;
  for (const t of [...pool.tiers].sort((a, b) => a.tier - b.tier)) {
    if (t.tier <= 1) continue;
    if (used + t.minPaise <= paidPaise) {
      used += t.minPaise;
      tier = t.tier;
    } else {
      break;
    }
  }
  return tier;
}

/**
 * Drop gifted / frozen ranks to leftover earn (all tiers), then charge
 * remaining earn through unpaid upgrade fees until they cannot pay more.
 */
export function settleLegacyTiers(input: {
  usersById: Record<string, RankedUser>;
  donorIds: string[];
  pool: PoolConfig;
  charityAllocations: SplitAllocation[];
  destinationNames: Record<string, string>;
}): {
  usersById: Record<string, RankedUser>;
  promotions: TierPromotion[];
  voucherDebits: Record<string, number>;
  demoted: number;
} {
  let demoted = 0;
  for (const id of input.donorIds) {
    const user = input.usersById[id];
    if (!user) continue;
    const live = tierFromReferralEarn(user.referralEarnPaise, input.pool.tiers);
    if (user.tier > live) demoted += 1;
    syncDisplayTier(user, input.pool);
  }

  const { usersById, promotions, voucherDebits } = runReferralTierPromotions({
    usersById: input.usersById,
    seedUserIds: input.donorIds,
    pool: input.pool,
    charityAllocations: input.charityAllocations,
    destinationNames: input.destinationNames,
    maxPromotions: 500,
  });

  return { usersById, promotions, voucherDebits, demoted };
}
