"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getApi } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { usePageRefresh } from "@/lib/page-refresh";
import type { AuraUser, LedgerEntry } from "@/lib/types";
import {
  AdminLoading,
  EmptyState,
  PageHeader,
} from "@/components/admin/ui";

export default function AdminLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [users, setUsers] = useState<AuraUser[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const api = getApi();
    const [e, u] = await Promise.all([api.listEntries(), api.listUsers()]);
    setEntries(e);
    setUsers(u);
    setLoading(false);
  }, []);

  usePageRefresh(load);

  const userById = useMemo(() => {
    const map: Record<string, AuraUser> = {};
    for (const u of users) map[u.uid] = u;
    return map;
  }, [users]);

  if (loading) return <AdminLoading label="Loading ledger…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ledger"
        description="Every entry stores the 4-way split, referral payouts, and charity sub-split snapshot."
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No ledger entries yet"
          description="Entries appear when donors enter amounts on the public site."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const donor = userById[e.userId];
            const open = openId === e.id;
            return (
              <article key={e.id} className="panel overflow-hidden !p-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02]"
                  onClick={() => setOpenId(open ? null : e.id)}
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="text-accent tabular-nums">
                        {formatPaise(e.amountPaise)}
                      </span>{" "}
                      <span className="text-sm font-normal text-muted">
                        from {donor?.displayName ?? e.userId.slice(0, 8)} · {e.mode}
                      </span>
                    </p>
                    {e.remarks && (
                      <p className="mt-0.5 text-xs text-accent">{e.remarks}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(e.createdAt).toLocaleString()} · {e.unitCount} units ·
                      charity v{e.charitySplitVersion}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted transition ${
                      open ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>
                {open && (
                  <div className="space-y-4 border-t border-white/10 bg-black/15 px-4 py-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["Ops", e.fourWay.opsPaise],
                          ["Charity", e.fourWay.charityPaise],
                          ["Reinvest", e.fourWay.reinvestPaise],
                          ["Referral", e.fourWay.referralPaise],
                          ["Dust", e.fourWay.dustPaise],
                        ] as const
                      ).map(([label, paise]) => (
                        <div
                          key={label}
                          className="flex justify-between rounded-lg bg-black/20 px-3 py-2"
                        >
                          <span className="text-muted">{label}</span>
                          <span className="tabular-nums text-foreground">
                            {formatPaise(paise)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                        Charity sub-split
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {e.charityAllocations.map((a) => (
                          <li
                            key={a.destinationId}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted">
                              {a.name} ({a.percent}%)
                            </span>
                            <span className="tabular-nums">
                              {formatPaise(a.amountPaise)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                        Referral payouts
                      </p>
                      {e.referralPayouts.length === 0 ? (
                        <p className="mt-2 text-muted">None (no upline)</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {e.referralPayouts.map((p, i) => (
                            <li
                              key={`${p.userId}-${i}`}
                              className="flex justify-between"
                            >
                              <span className="text-muted">
                                L{p.level} ·{" "}
                                {userById[p.userId]?.displayName ??
                                  p.userId.slice(0, 6)}
                              </span>
                              <span className="tabular-nums">
                                {formatPaise(p.amountPaise)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                {e.vouchersSpawned.length > 0 && (
                  <p className="rounded-lg bg-accent/10 px-3 py-2 text-accent">
                    Voucher credit added (referral earn)
                  </p>
                )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
