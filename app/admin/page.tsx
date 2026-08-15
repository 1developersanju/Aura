"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight } from "lucide-react";
import { getApi } from "@/lib/api";
import { formatPaise, paiseToRupees } from "@/lib/money";
import type { AuraUser, LedgerEntry, SystemWallet, Voucher, Wallet } from "@/lib/types";
import {
  AdminLoading,
  EmptyState,
  InlineAlert,
  PageHeader,
  Section,
  StatCard,
} from "@/components/admin/ui";

export default function AdminOverviewPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [system, setSystem] = useState<SystemWallet[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [users, setUsers] = useState<AuraUser[]>([]);
  const [destNames, setDestNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const api = getApi();
      const [e, s, w, v, dest, u] = await Promise.all([
        api.listEntries(),
        api.listSystemWallets(),
        api.listWallets(),
        api.listAllVouchers(),
        api.listDestinations(),
        api.listUsers(),
      ]);
      setEntries(e);
      setSystem(s);
      setWallets(w);
      setVouchers(v);
      setUsers(u);
      const names: Record<string, string> = {};
      for (const d of dest) names[d.id] = d.name;
      setDestNames(names);
      setLoading(false);
    })();
  }, []);

  async function reloadWallets() {
    const api = getApi();
    const [s, w] = await Promise.all([
      api.listSystemWallets(),
      api.listWallets(),
    ]);
    setSystem(s);
    setWallets(w);
  }

  async function resetWallets() {
    if (
      !window.confirm(
        "Zero all system and purpose wallet balances? Ledger history stays."
      )
    ) {
      return;
    }
    setResetting(true);
    setFlash(null);
    try {
      const { system: sysN, purpose } = await getApi().resetWallets();
      await reloadWallets();
      setFlash(`Wallets reset — ${sysN} system + ${purpose} purpose at ₹0.`);
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  const totalPaise = useMemo(
    () => entries.reduce((sum, e) => sum + e.amountPaise, 0),
    [entries]
  );

  const openVoucherPaise = useMemo(
    () =>
      vouchers
        .filter((v) => v.status === "open")
        .reduce((sum, v) => sum + v.valuePaise, 0),
    [vouchers]
  );

  const totalVoucherPaise = useMemo(
    () => vouchers.reduce((sum, v) => sum + v.valuePaise, 0),
    [vouchers]
  );

  const referralPaidPaise = useMemo(
    () =>
      users
        .filter((u) => u.role !== "admin")
        .reduce((sum, u) => sum + (u.referralEarnPaise ?? 0), 0),
    [users]
  );

  const referralSlicePaise = useMemo(
    () => entries.reduce((sum, e) => sum + e.fourWay.referralPaise, 0),
    [entries]
  );

  const chartData = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    let running = 0;
    return sorted.map((e) => {
      running += e.amountPaise;
      return {
        t: new Date(e.createdAt).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        cumulativeRupees: paiseToRupees(running),
      };
    });
  }, [entries]);

  if (loading) return <AdminLoading label="Loading overview…" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Pool health at a glance — volume, wallets, and cumulative growth."
        actions={
          <>
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={resetting}
              onClick={resetWallets}
            >
              {resetting ? "Resetting…" : "Reset wallets"}
            </button>
            <Link href="/admin/ledger" className="btn-ghost text-sm">
              Open ledger
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      {flash && (
        <InlineAlert tone={flash.toLowerCase().includes("fail") ? "error" : "success"}>
          {flash}
        </InlineAlert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pool volume" value={formatPaise(totalPaise)} accent />
        <StatCard
          label="Referral paid"
          value={formatPaise(referralPaidPaise)}
          hint={
            referralSlicePaise > 0
              ? `${formatPaise(referralSlicePaise)} from 25% slice`
              : undefined
          }
        />
        <StatCard label="Entries" value={entries.length} />
        <StatCard
          label="Voucher credit"
          value={formatPaise(totalVoucherPaise)}
          hint={`${formatPaise(openVoucherPaise)} open`}
        />
      </div>

      <Section
        title="System wallets"
        description="Ops, charity bucket before purpose split, and referral dust. Referral payouts sit on member balances."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {system.map((w) => (
            <div
              key={w.id}
              className="panel flex items-center justify-between gap-3 py-4"
            >
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                {w.id}
              </span>
              <span className="font-medium tabular-nums">
                {formatPaise(w.balancePaise)}
              </span>
            </div>
          ))}
          <div className="panel flex items-center justify-between gap-3 py-4 ring-1 ring-accent/25">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-accent">
              referral
            </span>
            <span className="font-medium tabular-nums text-accent">
              {formatPaise(referralPaidPaise)}
            </span>
          </div>
          {system.length === 0 && (
            <EmptyState title="No system wallets yet" description="They appear after the first entry." />
          )}
        </div>
      </Section>

      <Section
        title="Charity purpose wallets"
        description="Balances after the charity 25% sub-split."
        actions={
          <Link href="/admin/split" className="text-sm text-accent hover:underline">
            Edit split
          </Link>
        }
      >
        {wallets.length === 0 ? (
          <EmptyState
            title="No purpose wallets"
            description="Add destinations and save a charity split first."
            action={
              <Link href="/admin/destinations" className="btn-ghost text-sm">
                Add destinations
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {wallets.map((w) => (
              <div
                key={w.destinationId}
                className="panel flex items-center justify-between gap-3 py-4"
              >
                <span className="truncate text-sm text-muted">
                  {destNames[w.destinationId] ?? w.destinationId}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatPaise(w.balancePaise ?? Math.round((w.balance ?? 0) * 100))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Cumulative pool volume">
        <div className="panel">
          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <EmptyState
                title="No entries yet"
                description="The chart fills as donors enter amounts."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="auraFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3dd6a5" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3dd6a5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="t" stroke="#8aa399" fontSize={11} />
                  <YAxis stroke="#8aa399" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#12201c",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeRupees"
                    stroke="#3dd6a5"
                    fill="url(#auraFill)"
                    name="₹ cumulative"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
