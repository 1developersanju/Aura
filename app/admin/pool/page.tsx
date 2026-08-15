"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getApi } from "@/lib/api";
import type { PoolConfig } from "@/lib/types";
import {
  AdminLoading,
  InlineAlert,
  PageHeader,
  Section,
} from "@/components/admin/ui";

export default function AdminPoolSettingsPage() {
  const [pool, setPool] = useState<PoolConfig | null>(null);
  const [depth, setDepth] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await getApi().getPoolConfig();
      setPool(cfg);
      setDepth(String(cfg.referralDepth));
      setLoading(false);
    })();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const referralDepth = Math.min(10, Math.max(1, Number(depth) || 5));
      const saved = await getApi().savePoolConfig({ referralDepth });
      setPool(saved);
      setDepth(String(saved.referralDepth));
      setMessage("Pool settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !pool) return <AdminLoading label="Loading pool settings…" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pool settings"
        description="Fixed 4-way unit protocol, referral climb depth, and loyalty tiers."
      />

      <Section title="4-way unit protocol">
        <div className="panel space-y-4">
          <p className="text-sm text-muted">
            Every ₹1 (100 paise) entry splits into these buckets for this POC.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["Ops", pool.splits.ops],
                ["Charity / trust", pool.splits.charity],
                ["Customer reinvest", pool.splits.reinvest],
                ["Referral network", pool.splits.referral],
              ] as const
            ).map(([label, pct]) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-xl bg-black/25 px-3.5 py-3 text-sm"
              >
                <span className="text-muted">{label}</span>
                <span className="font-medium tabular-nums text-accent">{pct} paise</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Charity slice is further split in{" "}
            <Link href="/admin/split" className="text-accent hover:underline">
              Charity split
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section title="Referral depth">
        <form onSubmit={onSave} className="panel max-w-md space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Upline levels (1–10)</span>
            <input
              className="input w-32"
              type="number"
              min={1}
              max={10}
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save depth"}
          </button>
          {error && <InlineAlert tone="error">{error}</InlineAlert>}
          {message && <InlineAlert tone="success">{message}</InlineAlert>}
        </form>
      </Section>

      <Section
        title="Loyalty tiers"
        description="Upgrade fees come from referral earn, then that fee is 4-way split (ops / charity / reinvest / referral) and the member is promoted. Thresholds are read-only for this POC."
      >
        <div className="space-y-2">
          {pool.tiers.map((t) => (
            <div
              key={t.tier}
              className="panel flex items-center justify-between gap-3 py-3.5"
            >
              <span className="text-sm">
                <span className="text-accent">Tier {t.tier}</span>
                <span className="text-muted"> · {t.name}</span>
              </span>
              <span className="text-sm tabular-nums text-muted">
                ≥ ₹{(t.minPaise / 100).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
        <div className="panel mt-4 space-y-3">
          <p className="text-sm text-muted">
            Early members who were given a higher tier without paying, or who
            already paid Silver and now have leftover earn below ₹100, are
            aligned here. The badge follows leftover referral earn. Upgrade
            fees already taken are not charged again.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={settling}
            onClick={async () => {
              if (
                !confirm(
                  "Normalise legacy tiers? Members without paid fees will drop, then referral earn will be charged for upgrades they can afford."
                )
              ) {
                return;
              }
              setSettling(true);
              setError(null);
              setMessage(null);
              try {
                const result = await getApi().settleLegacyTiers();
                setMessage(
                  `Normalised ${result.usersTouched} members. Demoted unpaid ranks: ${result.demoted}. Upgrade fees charged: ${result.charged}.`
                );
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Normalise failed"
                );
              } finally {
                setSettling(false);
              }
            }}
          >
            {settling ? "Normalising…" : "Normalise unpaid tier upgrades"}
          </button>
        </div>
      </Section>
    </div>
  );
}
