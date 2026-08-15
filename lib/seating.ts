import { MAX_DIRECTS } from "./placement";
import type { AuraUser } from "./types";

export type FilledSeat = {
  kind: "filled";
  key: string;
  slot: number;
  parentUid: string | null;
  setId: string;
  user: AuraUser;
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

function byJoin(a: AuraUser, b: AuraUser): number {
  const t = a.createdAt.localeCompare(b.createdAt);
  return t !== 0 ? t : a.uid.localeCompare(b.uid);
}

export function seatCountForLevel(level: number): number {
  return level <= 0 ? 1 : MAX_DIRECTS ** level;
}

function parentKey(seat: TheaterSeat): string {
  return seat.kind === "filled" ? seat.user.uid : seat.key;
}

function expandRow(
  current: TheaterSeat[],
  children: Record<string, AuraUser[]>
): TheaterSeat[] {
  const next: TheaterSeat[] = [];
  for (const seat of current) {
    const kids =
      seat.kind === "filled" ? (children[seat.user.uid] ?? []) : [];
    const setId = setIdFor(parentKey(seat));
    const parentUid = seat.kind === "filled" ? seat.user.uid : seat.key;
    for (let slot = 0; slot < MAX_DIRECTS; slot++) {
      const child = kids[slot];
      if (child) {
        next.push({
          kind: "filled",
          key: child.uid,
          slot,
          parentUid,
          setId,
          user: child,
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

/** Always show a complete 5-wide house: level 0 = 1, 1 = 5, 2 = 25, then deeper if occupied. */
const MIN_LEVELS = 2;

export function buildTheaterRows(users: AuraUser[]): TheaterRow[] {
  const donors = users.filter((u) => u.role !== "admin").sort(byJoin);
  const byId: Record<string, AuraUser> = {};
  for (const u of donors) byId[u.uid] = u;

  const children: Record<string, AuraUser[]> = {};
  for (const u of donors) {
    if (!u.referredBy || !byId[u.referredBy]) continue;
    if (!children[u.referredBy]) children[u.referredBy] = [];
    children[u.referredBy]!.push(u);
  }
  for (const kids of Object.values(children)) kids.sort(byJoin);

  const roots = donors.filter((u) => !u.referredBy || !byId[u.referredBy]);
  if (roots.length === 0) return [];

  const rows: TheaterRow[] = [];
  let current: TheaterSeat[] = roots.map((user, slot) => ({
    kind: "filled" as const,
    key: user.uid,
    slot,
    parentUid: null,
    setId: setIdFor(null),
    user,
  }));

  let level = 0;
  let deepestFilled = 0;

  while (true) {
    rows.push({ level, seats: current });
    if (current.some((s) => s.kind === "filled")) deepestFilled = level;

    const next = expandRow(current, children);
    const nextHasPeople = next.some((s) => s.kind === "filled");
    const floor = Math.max(MIN_LEVELS, deepestFilled);
    if (level >= floor && !nextHasPeople) break;
    if (level >= 6) break;

    current = next;
    level += 1;
  }

  return rows;
}
