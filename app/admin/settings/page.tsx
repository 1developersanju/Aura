"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProduct } from "@/components/providers/ProductProvider";
import { getApi, getDataMode } from "@/lib/api";
import { adminBootstrapEmail } from "@/lib/firebase";
import type { ProductMode } from "@/lib/types";
import {
  InlineAlert,
  PageHeader,
  Section,
} from "@/components/admin/ui";

export default function AdminSettingsPage() {
  const { refreshUser, user } = useAuth();
  const { mode: productMode, setMode, refresh } = useProduct();
  const [email, setEmail] = useState(adminBootstrapEmail() ?? "admin@aura.demo");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onPromote(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const promoted = await getApi().promoteAdmin(email);
      setMessage(`Promoted ${promoted.email} to admin.`);
      if (user?.email === promoted.email) await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setLoading(false);
    }
  }

  async function switchMode(next: ProductMode) {
    setToggling(true);
    setError(null);
    try {
      await setMode(next);
      setMessage(
        next === "supermarket"
          ? "Public site is now Supermarket Loyalty mode."
          : "Public site is now Donations mode."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch mode");
    } finally {
      setToggling(false);
    }
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
    setError(null);
    setMessage(null);
    try {
      const { system, purpose } = await getApi().resetWallets();
      setMessage(
        `Wallets reset — ${system} system + ${purpose} purpose balances set to ₹0.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  async function resetDatabase() {
    if (resetConfirm.trim().toUpperCase() !== "RESET") {
      setError("Type RESET to confirm a full database wipe.");
      return;
    }
    if (
      !window.confirm(
        "This deletes all ledger entries and vouchers, zeros wallets, and clears member earn stats. Accounts and charity settings stay. Continue?"
      )
    ) {
      return;
    }
    setResettingDb(true);
    setError(null);
    setMessage(null);
    try {
      const result = await getApi().resetDatabase();
      setResetConfirm("");
      setMessage(
        `Database reset — removed ${result.entries} entries, ${result.vouchers} vouchers; zeroed ${result.wallets} wallets; cleared stats for ${result.usersReset} members.`
      );
      await refreshUser();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Database reset failed");
    } finally {
      setResettingDb(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Product mode, environment, and admin access."
      />

      {(error || message) && (
        <div className="space-y-2">
          {error && <InlineAlert tone="error">{error}</InlineAlert>}
          {message && <InlineAlert tone="success">{message}</InlineAlert>}
        </div>
      )}

      <Section
        title="Product mode"
        description="Switches public landing and customer copy. Pool engine stays the same."
      >
        <div className="panel space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={toggling}
              onClick={() => switchMode("donations")}
              className={`rounded-2xl px-4 py-4 text-left ring-1 transition ${
                productMode === "donations"
                  ? "bg-accent/15 text-foreground ring-accent/40"
                  : "text-muted ring-white/10 hover:text-foreground"
              }`}
            >
              <span className="block text-sm font-medium text-foreground">
                Donations
              </span>
              <span className="mt-1 block text-xs text-muted">
                Blind giving copy for the public site
              </span>
            </button>
            <button
              type="button"
              disabled={toggling}
              onClick={() => switchMode("supermarket")}
              className={`rounded-2xl px-4 py-4 text-left ring-1 transition ${
                productMode === "supermarket"
                  ? "bg-accent/15 text-foreground ring-accent/40"
                  : "text-muted ring-white/10 hover:text-foreground"
              }`}
            >
              <span className="block text-sm font-medium text-foreground">
                Supermarket loyalty
              </span>
              <span className="mt-1 block text-xs text-muted">
                Purchase / loyalty wording instead
              </span>
            </button>
          </div>
          <p className="text-xs text-muted">
            Active: <span className="text-foreground">{productMode}</span>
          </p>
        </div>
      </Section>

      <Section
        title="Reset wallets"
        description="Sets ops, charity, dust, and all purpose wallets to ₹0. Does not delete ledger entries."
      >
        <div className="panel flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Use this to clear demo balances before a fresh test run.
          </p>
          <button
            type="button"
            className="btn-ghost text-sm text-amber-200 ring-amber-500/30 hover:text-amber-100"
            disabled={resetting || resettingDb}
            onClick={resetWallets}
          >
            {resetting ? "Resetting…" : "Reset all wallet amounts"}
          </button>
        </div>
      </Section>

      <Section
        title="Reset database"
        description="Wipes transactional data for a clean POC slate. Keeps admin/donor accounts, destinations, split, and pool settings."
      >
        <div className="panel space-y-4 ring-1 ring-red-500/25">
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Deletes all ledger entries and vouchers</li>
            <li>Zeros system + purpose wallets</li>
            <li>Clears member lifetime / reinvest / referral earn (tier → 1)</li>
            <li>Does not delete user accounts or Auth logins</li>
          </ul>
          <label className="block max-w-sm space-y-1.5 text-sm">
            <span className="text-muted">
              Type <span className="font-medium text-foreground">RESET</span> to enable
            </span>
            <input
              className="input"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="RESET"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="btn-ghost text-sm text-red-200 ring-red-500/40 hover:bg-red-500/10 hover:text-red-100 disabled:opacity-40"
            disabled={
              resettingDb ||
              resetting ||
              resetConfirm.trim().toUpperCase() !== "RESET"
            }
            onClick={resetDatabase}
          >
            {resettingDb ? "Resetting database…" : "Reset database"}
          </button>
        </div>
      </Section>

      <Section title="Environment">
        <div className="panel grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
              Data backend
            </p>
            <p className="mt-1 text-sm text-foreground">{getDataMode()}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
              Bootstrap admin
            </p>
            <p className="mt-1 break-all text-sm text-accent">
              {adminBootstrapEmail() || "admin@aura.demo"}
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Promote admin"
        description="Designate an existing account as Aura admin by email."
      >
        <form onSubmit={onPromote} className="panel max-w-lg space-y-4">
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Promote to admin"}
          </button>
        </form>
      </Section>
    </div>
  );
}
