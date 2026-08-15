import { MAX_DIRECTS } from "./placement";
import type { AuraUser, HousePosition, UserRole } from "./types";

export const POSITION_DISPLAY_CAP = 40;

export function homePositionId(ownerUid: string): string {
  return positionId(ownerUid, 1);
}

export function positionId(ownerUid: string, index: number): string {
  return `${ownerUid}#${index}`;
}

export function positionDocId(id: string): string {
  return id.replaceAll("#", "__");
}

export function seatsFromLifetimePaise(lifetimePaise: number): number {
  return 1 + Math.floor(Math.max(0, lifetimePaise) / 100);
}

export function extraSeatCountByOwner(
  positions: HousePosition[]
): Record<string, number> {
  const n: Record<string, number> = {};
  for (const p of positions) {
    if (p.index < 2) continue;
    n[p.ownerUid] = (n[p.ownerUid] ?? 0) + 1;
  }
  return n;
}

/** Paise to take from reinvest wallet for newly minted extra chairs (₹1 each). */
export function walletDebitForNewSeats(
  prev: HousePosition[],
  next: HousePosition[]
): Record<string, number> {
  const before = extraSeatCountByOwner(prev);
  const after = extraSeatCountByOwner(next);
  const out: Record<string, number> = {};
  for (const uid of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const added = (after[uid] ?? 0) - (before[uid] ?? 0);
    if (added > 0) out[uid] = added * 100;
  }
  return out;
}

export function applyReinvestSeatSpend(
  users: Record<string, { reinvestPaise: number }>,
  debitPaise: Record<string, number>
) {
  for (const [uid, paise] of Object.entries(debitPaise)) {
    const u = users[uid];
    if (!u || paise <= 0) continue;
    u.reinvestPaise = Math.max(0, u.reinvestPaise - paise);
  }
}

export function nameSlug(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || "member";
}

/** Unique, stable slug per owner from display name (disambiguate duplicates). */
export function ownerNameSlugs(owners: PositionOwner[]): Record<string, string> {
  const used = new Map<string, string>();
  const out: Record<string, string> = {};
  const sorted = [...owners].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.uid.localeCompare(b.uid)
  );
  for (const o of sorted) {
    const base = nameSlug(o.displayName);
    let slug = base;
    if ([...used.values()].includes(slug)) {
      slug = `${base}-${o.uid.slice(0, 4).toLowerCase()}`;
    }
    used.set(o.uid, slug);
    out[o.uid] = slug;
  }
  return out;
}

export function positionTag(nameSlugValue: string, index: number): string {
  return `${nameSlugValue}-${index}`;
}

export type PositionOwner = {
  uid: string;
  role: UserRole;
  referralCode: string;
  displayName: string;
  createdAt: string;
  reinvestLifetimePaise: number;
};

function byOwnerThenIndex(
  a: HousePosition,
  b: HousePosition,
  createdAt: Record<string, string>
): number {
  const ta = createdAt[a.ownerUid] ?? "";
  const tb = createdAt[b.ownerUid] ?? "";
  const t = ta.localeCompare(tb);
  if (t !== 0) return t;
  const u = a.ownerUid.localeCompare(b.ownerUid);
  return u !== 0 ? u : a.index - b.index;
}

/** Next open BFS parent among already-placed positions. */
export function findPositionSpilloverParent(
  placed: HousePosition[]
): string | null {
  if (placed.length === 0) return null;

  const childCount = new Map<string, number>();
  for (const p of placed) {
    if (!p.parentPositionId) continue;
    childCount.set(
      p.parentPositionId,
      (childCount.get(p.parentPositionId) ?? 0) + 1
    );
  }

  const roots = placed.filter((p) => !p.parentPositionId);
  const queue = [...roots];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);

    if ((childCount.get(node.id) ?? 0) < MAX_DIRECTS) {
      return node.id;
    }

    const kids = placed
      .filter((p) => p.parentPositionId === node.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    queue.push(...kids);
  }

  return roots[0]?.id ?? placed[0]?.id ?? null;
}

export function climbPositionOwners(
  fromPositionId: string,
  positions: HousePosition[],
  depth: number
): string[] {
  const byId: Record<string, HousePosition> = {};
  for (const p of positions) byId[p.id] = p;
  const chain: string[] = [];
  let current = byId[fromPositionId]?.parentPositionId ?? null;
  let level = 0;
  const hops = new Set<string>();
  while (current && level < depth) {
    if (hops.has(current)) break;
    hops.add(current);
    const node = byId[current];
    if (!node) break;
    chain.push(node.ownerUid);
    current = node.parentPositionId;
    level += 1;
  }
  return chain;
}

/**
 * Ensure each donor has max(1, floor(lifetime/100)) positions.
 * Existing chairs keep their parents. Missing home seats (#1) are placed
 * first in join order, then extra samples append to the next BFS slot so
 * they never jump in front of people already seated.
 */
export function syncHousePositions(
  existing: HousePosition[],
  owners: PositionOwner[],
  nowIso: string
): HousePosition[] {
  const donors = owners
    .filter((o) => o.role !== "admin")
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.uid.localeCompare(b.uid)
    );
  const slugs = ownerNameSlugs(donors);
  const positions = existing.map((p) => {
    const slug = slugs[p.ownerUid];
    return slug ? { ...p, tag: positionTag(slug, p.index) } : { ...p };
  });
  const have = new Set(positions.map((p) => p.id));
  let seq = 0;
  const stamp = () => {
    seq += 1;
    return new Date(Date.parse(nowIso) + seq).toISOString();
  };

  function append(owner: PositionOwner, index: number) {
    const id = positionId(owner.uid, index);
    if (have.has(id)) return;
    const parent = findPositionSpilloverParent(positions);
    positions.push({
      id,
      ownerUid: owner.uid,
      index,
      tag: positionTag(slugs[owner.uid] ?? nameSlug(owner.displayName), index),
      parentPositionId: parent,
      createdAt: stamp(),
    });
    have.add(id);
  }

  for (const owner of donors) append(owner, 1);
  for (const owner of donors) {
    const needed = seatsFromLifetimePaise(owner.reinvestLifetimePaise);
    for (let index = 2; index <= needed; index++) append(owner, index);
  }

  return positions;
}

/**
 * One-time / repair layout: all home chairs (#1) in join order, then extra
 * samples on the remaining BFS seats. Does not interleave name-2 between people.
 */
export function layoutHomesThenExtras(
  positions: HousePosition[],
  owners: PositionOwner[]
): { positions: HousePosition[]; updated: number } {
  const createdAt: Record<string, string> = {};
  for (const o of owners) createdAt[o.uid] = o.createdAt;
  const slugs = ownerNameSlugs(owners.filter((o) => o.role !== "admin"));
  const adminUids = new Set(
    owners.filter((o) => o.role === "admin").map((o) => o.uid)
  );
  const pool = positions.filter((p) => !adminUids.has(p.ownerUid));
  const homes = pool
    .filter((p) => p.index === 1)
    .sort((a, b) => byOwnerThenIndex(a, b, createdAt));
  const extras = pool
    .filter((p) => p.index > 1)
    .sort((a, b) => byOwnerThenIndex(a, b, createdAt));

  const placed: HousePosition[] = [];
  let updated = 0;
  for (const p of [...homes, ...extras]) {
    const parent = findPositionSpilloverParent(placed);
    const tag = positionTag(slugs[p.ownerUid] ?? "member", p.index);
    if (p.parentPositionId !== parent || p.tag !== tag) updated += 1;
    placed.push({
      ...p,
      tag,
      parentPositionId: parent,
    });
  }
  return { positions: placed, updated };
}

export function repairHousePositions(
  existing: HousePosition[],
  owners: PositionOwner[],
  nowIso: string
): { positions: HousePosition[]; updated: number } {
  const synced = syncHousePositions(existing, owners, nowIso);
  return layoutHomesThenExtras(synced, owners);
}

export function ownersFromUsers(users: AuraUser[]): PositionOwner[] {
  return users.map((u) => ({
    uid: u.uid,
    role: u.role,
    referralCode: u.referralCode,
    displayName: u.displayName,
    createdAt: u.createdAt,
    reinvestLifetimePaise: u.reinvestLifetimePaise,
  }));
}

export function capPositionsForDisplay(
  positions: HousePosition[]
): HousePosition[] {
  const counts = new Map<string, number>();
  const out: HousePosition[] = [];
  for (const p of [...positions].sort((a, b) => a.index - b.index)) {
    const n = counts.get(p.ownerUid) ?? 0;
    if (n >= POSITION_DISPLAY_CAP) continue;
    counts.set(p.ownerUid, n + 1);
    out.push(p);
  }
  return out;
}
