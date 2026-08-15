import type { UserRole } from "./types";

/** Max direct downlines per member before spillover to the next open slot. */
export const MAX_DIRECTS = 5;

export type PlacementMember = {
  uid: string;
  role: UserRole;
  referredBy: string | null;
  createdAt: string;
};

function byJoinOrder(a: PlacementMember, b: PlacementMember): number {
  const t = a.createdAt.localeCompare(b.createdAt);
  return t !== 0 ? t : a.uid.localeCompare(b.uid);
}

/**
 * Sequential BFS fill: earliest donor is root. Each next joiner takes the
 * leftmost open slot (max MAX_DIRECTS per person), then spillover to the
 * next member in join order. Invite codes do not jump the queue.
 */
export function findSpilloverParent(
  members: PlacementMember[]
): string | null {
  const pool = members.filter((u) => u.role !== "admin").sort(byJoinOrder);
  if (pool.length === 0) return null;

  const childCount = new Map<string, number>();
  for (const u of pool) {
    if (!u.referredBy) continue;
    childCount.set(u.referredBy, (childCount.get(u.referredBy) ?? 0) + 1);
  }

  const roots = pool.filter((u) => !u.referredBy);
  const queue = [...roots];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (seen.has(node.uid)) continue;
    seen.add(node.uid);

    if ((childCount.get(node.uid) ?? 0) < MAX_DIRECTS) {
      return node.uid;
    }

    const kids = pool.filter((u) => u.referredBy === node.uid).sort(byJoinOrder);
    queue.push(...kids);
  }

  return roots[0]?.uid ?? pool[0]?.uid ?? null;
}

/**
 * Rebuild the whole tree in signup order: earliest donor is root,
 * each next donor is sequential BFS-spillover under the growing tree.
 * Admins stay outside the tree (referredBy = null).
 */
export function rebuildSpilloverAssignments(
  members: PlacementMember[]
): Map<string, string | null> {
  const donors = members.filter((u) => u.role !== "admin").sort(byJoinOrder);

  const result = new Map<string, string | null>();
  const placed: PlacementMember[] = [];

  for (const m of donors) {
    const parent = findSpilloverParent(placed);
    result.set(m.uid, parent);
    placed.push({ ...m, referredBy: parent });
  }

  for (const m of members) {
    if (m.role === "admin") result.set(m.uid, null);
  }

  return result;
}
