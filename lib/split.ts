import type { DonationAllocation, SplitAllocation } from "./types";

/** Split amount by percents; last destination absorbs rounding remainder. */
export function computeSplitAmounts(
  amount: number,
  allocations: SplitAllocation[],
  names: Record<string, string>
): DonationAllocation[] {
  if (allocations.length === 0) {
    throw new Error("No active split configured. Ask Aura admin to set destinations and percentages.");
  }

  const totalPercent = allocations.reduce((sum, a) => sum + a.percent, 0);
  if (Math.abs(totalPercent - 100) > 0.001) {
    throw new Error(`Split must total 100% (currently ${totalPercent}%).`);
  }

  const cents = Math.round(amount * 100);
  const results: DonationAllocation[] = [];
  let allocatedCents = 0;

  allocations.forEach((alloc, index) => {
    const isLast = index === allocations.length - 1;
    let partCents: number;
    if (isLast) {
      partCents = cents - allocatedCents;
    } else {
      partCents = Math.round((cents * alloc.percent) / 100);
      allocatedCents += partCents;
    }
    results.push({
      destinationId: alloc.destinationId,
      name: names[alloc.destinationId] ?? "Unknown",
      percent: alloc.percent,
      amount: partCents / 100,
    });
  });

  return results;
}

export function sumPercents(allocations: SplitAllocation[]): number {
  return allocations.reduce((sum, a) => sum + a.percent, 0);
}
