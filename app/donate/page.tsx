"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProduct } from "@/components/providers/ProductProvider";
import { getApi } from "@/lib/api";

function EntryForm() {
  const { user, refreshUser } = useAuth();
  const { nouns, isSupermarket } = useProduct();
  const router = useRouter();
  const [amount, setAmount] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await getApi().createEntry(user.uid, Number(amount));
      await refreshUser();
      setDone(true);
      setTimeout(() => router.push("/donations"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entry failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl text-foreground">
        {isSupermarket ? "Record purchase" : "Donate to Aura"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {isSupermarket
          ? "Enter a whole-rupee purchase amount. The loyalty engine allocates ops, charity, your reinvestment wallet, and referral rewards in paise."
          : "Enter a whole-rupee donation. Aura runs the same pool protocol — you won’t see the 4-way math."}
      </p>
      <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Amount (DEMO · whole ₹)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-muted">
              ₹
            </span>
            <input
              className="input pl-10"
              type="number"
              min="1"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </label>
        <div className="flex flex-wrap gap-2">
          {[10, 25, 50, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-muted ring-1 ring-white/10 hover:text-foreground"
              onClick={() => setAmount(String(preset))}
            >
              ₹{preset}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {done && <p className="text-sm text-accent">Thank you — recorded.</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading || done}>
          {loading ? "Recording…" : nouns.action}
        </button>
      </form>
    </div>
  );
}

export default function DonatePage() {
  return (
    <RequireAuth>
      <EntryForm />
    </RequireAuth>
  );
}
