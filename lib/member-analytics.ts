import type { AuraUser, LedgerEntry, Voucher } from "./types";

export type MemberAnalytics = {
  user: AuraUser;
  entryCount: number;
  paidInPaise: number;
  split: {
    opsPaise: number;
    charityPaise: number;
    reinvestPaise: number;
    referralPaise: number;
    dustPaise: number;
  };
  charityByName: { name: string; amountPaise: number }[];
  paidToUpline: { userId: string; name: string; amountPaise: number }[];
  receivedFromNetwork: { fromUserId: string; fromName: string; amountPaise: number }[];
  receivedTotalPaise: number;
  voucherOpenPaise: number;
  voucherClaimedPaise: number;
  directs: number;
  downline: number;
  entries: LedgerEntry[];
};

function displayName(users: Record<string, AuraUser>, uid: string): string {
  return users[uid]?.displayName ?? uid.slice(0, 8);
}

export function descendantIds(
  rootId: string,
  children: Record<string, AuraUser[]>
): Set<string> {
  const out = new Set<string>();
  const walk = (id: string) => {
    for (const c of children[id] ?? []) {
      if (out.has(c.uid)) continue;
      out.add(c.uid);
      walk(c.uid);
    }
  };
  walk(rootId);
  return out;
}

export function analyzeMember(
  user: AuraUser,
  users: AuraUser[],
  entries: LedgerEntry[],
  vouchers: Voucher[]
): MemberAnalytics {
  const byId: Record<string, AuraUser> = {};
  const children: Record<string, AuraUser[]> = {};
  for (const u of users) {
    byId[u.uid] = u;
    if (!u.referredBy) continue;
    if (!children[u.referredBy]) children[u.referredBy] = [];
    children[u.referredBy]!.push(u);
  }

  const own = entries
    .filter((e) => e.userId === user.uid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const split = {
    opsPaise: 0,
    charityPaise: 0,
    reinvestPaise: 0,
    referralPaise: 0,
    dustPaise: 0,
  };
  const charityMap = new Map<string, number>();
  const toUpline = new Map<string, number>();

  for (const e of own) {
    split.opsPaise += e.fourWay.opsPaise;
    split.charityPaise += e.fourWay.charityPaise;
    split.reinvestPaise += e.fourWay.reinvestPaise;
    split.referralPaise += e.fourWay.referralPaise;
    split.dustPaise += e.fourWay.dustPaise;
    for (const a of e.charityAllocations) {
      charityMap.set(a.name, (charityMap.get(a.name) ?? 0) + a.amountPaise);
    }
    for (const p of e.referralPayouts) {
      toUpline.set(p.userId, (toUpline.get(p.userId) ?? 0) + p.amountPaise);
    }
  }

  const fromNetwork = new Map<string, number>();
  for (const e of entries) {
    if (e.userId === user.uid) continue;
    for (const p of e.referralPayouts) {
      if (p.userId !== user.uid) continue;
      fromNetwork.set(e.userId, (fromNetwork.get(e.userId) ?? 0) + p.amountPaise);
    }
  }

  const mine = vouchers.filter((v) => v.userId === user.uid);
  const down = descendantIds(user.uid, children);

  return {
    user,
    entryCount: own.length,
    paidInPaise: own.reduce((s, e) => s + e.amountPaise, 0),
    split,
    charityByName: [...charityMap.entries()]
      .map(([name, amountPaise]) => ({ name, amountPaise }))
      .sort((a, b) => b.amountPaise - a.amountPaise),
    paidToUpline: [...toUpline.entries()].map(([userId, amountPaise]) => ({
      userId,
      name: displayName(byId, userId),
      amountPaise,
    })),
    receivedFromNetwork: [...fromNetwork.entries()].map(([fromUserId, amountPaise]) => ({
      fromUserId,
      fromName: displayName(byId, fromUserId),
      amountPaise,
    })),
    receivedTotalPaise: [...fromNetwork.values()].reduce((s, n) => s + n, 0),
    voucherOpenPaise: mine
      .filter((v) => v.status === "open")
      .reduce((s, v) => s + v.valuePaise, 0),
    voucherClaimedPaise: mine
      .filter((v) => v.status === "redeemed")
      .reduce((s, v) => s + v.valuePaise, 0),
    directs: (children[user.uid] ?? []).length,
    downline: down.size,
    entries: own,
  };
}
