import { MAX_DIRECTS } from "./placement";
import { capPositionsForDisplay } from "./positions";
import type { AuraUser, HousePosition } from "./types";

export type FilledSeat = {
  kind: "filled";
  key: string;
  slot: number;
  parentUid: string | null;
  setId: string;
  user: AuraUser;
  tag: string;
  instance: number;
  sampleCount: number;
};

export type EmptySeat = {
  kind: "empty";
  key: string;
  slot: number;
  parentUid: string | null;
  setId: string;
};

export type TheaterSeat = FilledSeat | EmptySeat;

export type TheaterRow = {
  level: number;
  seats: TheaterSeat[];
};

const HOUSE_SET = "house-root";

/** Distinct colours for each 5-seat set (children of one parent). */
export const SET_PALETTE = [
  { fill: "#3dd6a5", ink: "#04241c", name: "Mint" },
  { fill: "#f0c14b", ink: "#1a1404", name: "Gold" },
  { fill: "#6cb6ff", ink: "#041525", name: "Sky" },
  { fill: "#ff8fab", ink: "#2a0a14", name: "Rose" },
  { fill: "#c4a7ff", ink: "#16082a", name: "Violet" },
  { fill: "#ff9f6b", ink: "#1f0e06", name: "Coral" },
  { fill: "#5eead4", ink: "#04241c", name: "Teal" },
  { fill: "#f5a3ff", ink: "#1a0820", name: "Orchid" },
  { fill: "#94e06b", ink: "#0c1806", name: "Lime" },
  { fill: "#ffd580", ink: "#1a1204", name: "Sand" },
] as const;

export type SetSwatch = (typeof SET_PALETTE)[number];

export function setSwatch(setId: string): SetSwatch {
  let h = 2166136261;
  for (let i = 0; i < setId.length; i++) {
    h ^= setId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return SET_PALETTE[Math.abs(h) % SET_PALETTE.length]!;
}

function setIdFor(parentUid: string | null): string {
  return parentUid ?? HOUSE_SET;
}

export function seatCountForLevel(level: number): number {
  return level <= 0 ? 1 : MAX_DIRECTS ** level;
}

function parentKey(seat: TheaterSeat): string {
  return seat.kind === "filled" ? seat.key : seat.key;
}

function expandRow(
  current: TheaterSeat[],
  children: Record<string, HousePosition[]>,
  usersById: Record<string, AuraUser>,
  sampleCount: Record<string, number>
): TheaterSeat[] {
  const next: TheaterSeat[] = [];
  for (const seat of current) {
    const kids = seat.kind === "filled" ? (children[seat.key] ?? []) : [];
    const setId = setIdFor(parentKey(seat));
    const parentUid = seat.kind === "filled" ? seat.key : seat.key;
    for (let slot = 0; slot < MAX_DIRECTS; slot++) {
      const child = kids[slot];
      const owner = child ? usersById[child.ownerUid] : undefined;
      if (child && owner) {
        next.push({
          kind: "filled",
          key: child.id,
          slot,
          parentUid,
          setId,
          user: owner,
          tag: child.tag,
          instance: child.index,
          sampleCount: sampleCount[owner.uid] ?? child.index,
        });
      } else {
        next.push({
          kind: "empty",
          key: `${parentKey(seat)}-open-${slot}`,
          slot,
          parentUid,
          setId,
        });
      }
    }
  }
  return next;
}

const MIN_LEVELS = 2;

export function buildTheaterRows(
  users: AuraUser[],
  positions: HousePosition[]
): TheaterRow[] {
  const donors = users.filter((u) => u.role !== "admin");
  const usersById: Record<string, AuraUser> = {};
  for (const u of donors) usersById[u.uid] = u;

  const visible = capPositionsForDisplay(positions).filter(
    (p) => usersById[p.ownerUid]
  );
  const sampleCount: Record<string, number> = {};
  for (const p of positions) {
    if (!usersById[p.ownerUid]) continue;
    sampleCount[p.ownerUid] = Math.max(sampleCount[p.ownerUid] ?? 0, p.index);
  }

  const byId: Record<string, HousePosition> = {};
  for (const p of visible) byId[p.id] = p;

  const children: Record<string, HousePosition[]> = {};
  for (const p of visible) {
    if (!p.parentPositionId || !byId[p.parentPositionId]) continue;
    if (!children[p.parentPositionId]) children[p.parentPositionId] = [];
    children[p.parentPositionId]!.push(p);
  }
  for (const kids of Object.values(children)) {
    kids.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
    );
  }

  const roots = visible.filter(
    (p) => !p.parentPositionId || !byId[p.parentPositionId]
  );
  if (roots.length === 0) return [];

  const rows: TheaterRow[] = [];
  let current: TheaterSeat[] = roots.map((pos, slot) => {
    const owner = usersById[pos.ownerUid]!;
    return {
      kind: "filled" as const,
      key: pos.id,
      slot,
      parentUid: null,
      setId: setIdFor(null),
      user: owner,
      tag: pos.tag,
      instance: pos.index,
      sampleCount: sampleCount[owner.uid] ?? pos.index,
    };
  });

  let level = 0;
  let deepestFilled = 0;

  while (true) {
    rows.push({ level, seats: current });
    if (current.some((s) => s.kind === "filled")) deepestFilled = level;

    const next = expandRow(current, children, usersById, sampleCount);
    const nextHasPeople = next.some((s) => s.kind === "filled");
    const floor = Math.max(MIN_LEVELS, deepestFilled);
    if (level >= floor && !nextHasPeople) break;
    if (level >= 6) break;

    current = next;
    level += 1;
  }

  return rows;
}
