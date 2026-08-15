import type { PoolConfig, ProductConfig, TierThreshold } from "./types";

export const DEFAULT_TIERS: TierThreshold[] = [
  { tier: 1, name: "Starter", minPaise: 100 },
  { tier: 2, name: "Silver", minPaise: 10_000 },
  { tier: 3, name: "Gold", minPaise: 100_000 },
  { tier: 4, name: "Diamond", minPaise: 1_000_000 },
  { tier: 5, name: "Platinum", minPaise: 10_000_000 },
];

export function defaultPoolConfig(): PoolConfig {
  return {
    referralDepth: 5,
    unitPaise: 100,
    splits: { ops: 25, charity: 25, reinvest: 25, referral: 25 },
    tiers: DEFAULT_TIERS,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultProductConfig(): ProductConfig {
  return {
    mode: "donations",
    updatedAt: new Date().toISOString(),
  };
}

export function tierFromLifetime(lifetimePaise: number, tiers: TierThreshold[]): number {
  const sorted = [...tiers].sort((a, b) => a.minPaise - b.minPaise);
  let tier = 1;
  for (const t of sorted) {
    if (lifetimePaise >= t.minPaise) tier = t.tier;
  }
  return tier;
}

export function nextTierProgress(
  lifetimePaise: number,
  tiers: TierThreshold[]
): { current: TierThreshold; next: TierThreshold | null; progress: number } {
  const sorted = [...tiers].sort((a, b) => a.minPaise - b.minPaise);
  const current =
    [...sorted].reverse().find((t) => lifetimePaise >= t.minPaise) ?? sorted[0]!;
  const next = sorted.find((t) => t.minPaise > lifetimePaise) ?? null;
  if (!next) {
    return { current, next: null, progress: 1 };
  }
  const prevMin = current.minPaise;
  const span = next.minPaise - prevMin;
  const progress = span <= 0 ? 1 : Math.min(1, (lifetimePaise - prevMin) / span);
  return { current, next, progress };
}
