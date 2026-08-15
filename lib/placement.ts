import type { UserRole } from "./types";

/** Max direct downlines per member before spillover to the next open slot. */
export const MAX_DIRECTS = 5;

export type PlacementMember = {
  uid: string;
  role: UserRole;
  referredBy: string | null;
  createdAt: string;
};

/**
 * Breadth-first spillover: each member can hold up to MAX_DIRECTS directs.
 * Tree grows infinitely by filling level-by-level.
 * Optional preferredParent is used when they still have an open slot.
 */
export function findSpilloverParent(
  members: PlacementMember[],
  preferredParentId?: string | null
): string | null {
  const pool = members.filter((u) => u.role !== "admin");
  if (pool.length === 0) return null;

  const childCount = new Map<string, number>();
  for (const u of pool) {
    if (!u.referredBy) continue;
    childCount.set(u.referredBy, (childCount.get(u.referredBy) ?? 0) + 1);
  }

  if (preferredParentId) {
    const preferred = pool.find((u) => u.uid === preferredParentId);
    if (preferred && (childCount.get(preferred.uid) ?? 0) < MAX_DIRECTS) {
      return preferred.uid;
    }
  }

  const roots = pool
    .filter((u) => !u.referredBy)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const queue = [...roots];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (seen.has(node.uid)) continue;
    seen.add(node.uid);

    if ((childCount.get(node.uid) ?? 0) < MAX_DIRECTS) {
      return node.uid;
    }

    const kids = pool
      .filter((u) => u.referredBy === node.uid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    queue.push(...kids);
  }

  // Fallback: earliest member (should be unreachable if MAX_DIRECTS > 0)
  return roots[0]?.uid ?? pool[0]?.uid ?? null;
}

/**
 * Rebuild the whole tree in signup order: earliest donor is root,
 * each next donor is BFS-spillover placed under the growing tree.
 * Admins are left with referredBy = null.
 */
export function rebuildSpilloverAssignments(
  members: PlacementMember[]
): Map<string, string | null> {
  const donors = members
    .filter((u) => u.role !== "admin")
    .sort((a, b) => {
      const t = a.createdAt.localeCompare(b.createdAt);
      return t !== 0 ? t : a.uid.localeCompare(b.uid);
    });

  const result = new Map<string, string | null>();
  const placed: PlacementMember[] = [];

  for (const m of donors) {
    const parent = findSpilloverParent(placed, null);
    result.set(m.uid, parent);
    placed.push({ ...m, referredBy: parent });
  }

  for (const m of members) {
    if (m.role === "admin") result.set(m.uid, null);
  }

  return result;
}
