"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProduct } from "@/components/providers/ProductProvider";
import { getApi } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { nextTierProgress } from "@/lib/pool-config";
import type { LedgerEntry, PoolConfig, Voucher } from "@/lib/types";

function HistoryPanel() {
  const { user, refreshUser } = useAuth();
  const { nouns, isSupermarket } = useProduct();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [pool, setPool] = useState<PoolConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    if (!user) return;
    const api = getApi();
    const [e, v, p] = await Promise.all([
      api.listEntriesForUser(user.uid),
      api.listVouchersForUser(user.uid),
      api.getPoolConfig(),
    ]);
    setEntries(e);
    setVouchers(v);
    setPool(p);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const progress = useMemo(() => {
    if (!user || !pool) return null;
    return nextTierProgress(user.lifetimePaise, pool.tiers);
  }, [user, pool]);

  async function redeem(id: string) {
    if (!user) return;
    setBusyId(id);
    try {
      await getApi().redeemVoucher(id, user.uid);
      await reload();
      await refreshUser();
    } finally {
      setBusyId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="font-display text-3xl text-foreground">{nouns.history}</h1>
      <p className="mt-3 rounded-xl bg-accent/10 px-4 py-3 text-sm leading-relaxed text-accent ring-1 ring-accent/25">
        {isSupermarket
          ? "Your loyalty state stays private. Pool math and other shoppers are admin-only."
          : "Your gifts go to Aura’s causes. Allocation details stay private."}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="panel py-4">
          <p className="text-xs uppercase tracking-wider text-muted">Tier</p>
          <p className="mt-1 font-display text-2xl">{user.tier}</p>
        </div>
        <div className="panel py-4">
          <p className="text-xs uppercase tracking-wider text-muted">Reinvest</p>
          <p className="mt-1 font-display text-2xl">
            {formatPaise(user.reinvestPaise)}
          </p>
        </div>
        <div className="panel py-4">
          <p className="text-xs uppercase tracking-wider text-muted">Lifetime</p>
          <p className="mt-1 font-display text-2xl">
            {formatPaise(user.lifetimePaise)}
          </p>
        </div>
      </div>

      {progress && (
        <div className="panel mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted">
              {progress.current.name}
              {progress.next ? ` → ${progress.next.name}` : " (max)"}
            </span>
            <span className="text-accent">
              {Math.round(progress.progress * 100)}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl">Vouchers</h2>
        <div className="mt-3 space-y-2">
          {vouchers.length === 0 && (
            <p className="text-sm text-muted">
              No vouchers yet — reinvestment hits ₹1 to spawn one.
            </p>
          )}
          {vouchers.map((v) => (
            <div
              key={v.id}
              className="panel flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-mono text-sm text-accent">{v.code}</p>
                <p className="text-xs text-muted">
                  {formatPaise(v.valuePaise)} · {v.status}
                </p>
              </div>
              {v.status === "open" && (
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={busyId === v.id}
                  onClick={() => redeem(v.id)}
                >
                  {busyId === v.id ? "…" : "Mark redeemed"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 space-y-3">
        <h2 className="font-display text-xl">History</h2>
        {loading && <p className="text-sm text-muted">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted">No {nouns.entries} yet.</p>
        )}
        {entries.map((d) => (
          <article
            key={d.id}
            className="panel flex items-center justify-between gap-4 py-4"
          >
            <div>
              <p className="font-medium text-foreground">
                {formatPaise(d.amountPaise)}
              </p>
              <p className="text-xs text-muted">
                {new Date(d.createdAt).toLocaleString()} · {d.unitCount} units · DEMO
              </p>
            </div>
            <span className="text-xs uppercase tracking-wider text-muted">
              Recorded
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function DonationsPage() {
  return (
    <RequireAuth>
      <HistoryPanel />
    </RequireAuth>
  );
}
