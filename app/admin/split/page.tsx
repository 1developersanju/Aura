"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { getApi } from "@/lib/api";
import { sumPercents } from "@/lib/split";
import type { Destination, DestinationKind, SplitAllocation } from "@/lib/types";
import {
  AdminLoading,
  EmptyState,
  InlineAlert,
  PageHeader,
  Section,
} from "@/components/admin/ui";

export default function AdminSplitPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [allocations, setAllocations] = useState<SplitAllocation[]>([]);
  const [percentDrafts, setPercentDrafts] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  const [purposeName, setPurposeName] = useState("");
  const [purposeKind, setPurposeKind] = useState<DestinationKind>("purpose");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function syncDrafts(next: SplitAllocation[]) {
    const drafts: Record<string, string> = {};
    for (const a of next) {
      drafts[a.destinationId] = a.percent === 0 ? "" : String(a.percent);
    }
    setPercentDrafts(drafts);
  }

  async function reload() {
    const api = getApi();
    const [dest, split] = await Promise.all([api.listDestinations(), api.getSplit()]);
    setDestinations(dest);
    setVersion(split.version);
    const activeIds = new Set(dest.filter((d) => d.active).map((d) => d.id));
    const fromConfig = split.allocations.filter((a) => activeIds.has(a.destinationId));
    setAllocations(fromConfig);
    syncDrafts(fromConfig);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  const total = useMemo(() => sumPercents(allocations), [allocations]);
  const totalOk = Math.abs(total - 100) < 0.001;

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of destinations) map[d.id] = d.name;
    return map;
  }, [destinations]);

  function setPercentDraft(destinationId: string, raw: string) {
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    setPercentDrafts((prev) => ({ ...prev, [destinationId]: raw }));
    const parsed = raw === "" || raw === "." ? 0 : Number(raw);
    if (!Number.isFinite(parsed)) return;
    setAllocations((prev) =>
      prev.map((a) =>
        a.destinationId === destinationId ? { ...a, percent: parsed } : a
      )
    );
  }

  function removeAllocation(destinationId: string) {
    setError(null);
    setMessage(null);
    setAllocations((prev) => prev.filter((a) => a.destinationId !== destinationId));
    setPercentDrafts((prev) => {
      const next = { ...prev };
      delete next[destinationId];
      return next;
    });
  }

  function clearAll() {
    setError(null);
    setMessage(null);
    setAllocations([]);
    setPercentDrafts({});
  }

  async function addPurpose(e?: FormEvent) {
    e?.preventDefault();
    const name = purposeName.trim();
    if (!name) {
      setError("Type a purpose or charity name.");
      return;
    }

    setError(null);
    setMessage(null);
    setAdding(true);
    try {
      const api = getApi();
      const existing = destinations.find(
        (d) => d.name.trim().toLowerCase() === name.toLowerCase()
      );

      let dest: Destination;
      if (existing) {
        if (allocations.some((a) => a.destinationId === existing.id)) {
          throw new Error(`“${existing.name}” is already in this split.`);
        }
        if (!existing.active) {
          dest = await api.updateDestination(existing.id, { active: true });
        } else {
          dest = existing;
        }
      } else {
        dest = await api.createDestination({ name, kind: purposeKind });
      }

      setDestinations((prev) => {
        const without = prev.filter((d) => d.id !== dest.id);
        return [...without, dest];
      });
      setAllocations((prev) => [...prev, { destinationId: dest.id, percent: 0 }]);
      setPercentDrafts((prev) => ({ ...prev, [dest.id]: "" }));
      setPurposeName("");
      setPurposeKind("purpose");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add purpose");
    } finally {
      setAdding(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      if (allocations.length === 0) {
        throw new Error("Add at least one purpose to the split.");
      }
      const cleaned = allocations.filter((a) => a.percent > 0);
      if (cleaned.length === 0) {
        throw new Error("Set a percentage greater than 0 for at least one purpose.");
      }
      const saved = await getApi().saveSplit(cleaned);
      setVersion(saved.version);
      setAllocations(saved.allocations);
      syncDrafts(saved.allocations);
      setMessage("Split saved. Future donations use this version.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminLoading label="Loading charity split…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Charity split"
        description={`Where the charity 25% goes. Changes apply only to new entries (version ${version}).`}
      />

      <Section
        title="Add to split"
        actions={
          allocations.length > 0 ? (
            <button type="button" className="btn-ghost text-sm" onClick={clearAll}>
              Clear all
            </button>
          ) : undefined
        }
      >
        <form onSubmit={addPurpose} className="panel space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input flex-1"
              placeholder="e.g. Education, Food relief, Partner Charity"
              value={purposeName}
              onChange={(e) => setPurposeName(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-sm ring-1 transition ${
                  purposeKind === "purpose"
                    ? "bg-accent/20 text-accent ring-accent/40"
                    : "text-muted ring-white/10 hover:text-foreground"
                }`}
                onClick={() => setPurposeKind("purpose")}
              >
                Purpose
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-sm ring-1 transition ${
                  purposeKind === "charity"
                    ? "bg-accent/20 text-accent ring-accent/40"
                    : "text-muted ring-white/10 hover:text-foreground"
                }`}
                onClick={() => setPurposeKind("charity")}
              >
                Charity
              </button>
              <button
                type="submit"
                className="btn-ghost inline-flex items-center justify-center gap-1.5"
                disabled={adding || !purposeName.trim()}
              >
                <Plus className="h-4 w-4" />
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </Section>

      <form onSubmit={onSave} className="space-y-4">
        {allocations.length === 0 ? (
          <EmptyState
            title="Split is empty"
            description="Type a purpose above, set percentages to 100%, then save."
          />
        ) : (
          <div className="space-y-2">
            {allocations.map((a) => (
              <div
                key={a.destinationId}
                className="panel flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div>
                  <p className="text-sm font-medium">
                    {nameById[a.destinationId] ?? a.destinationId}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-muted">
                    {destinations.find((d) => d.id === a.destinationId)?.kind ??
                      "purpose"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="input w-24 text-right"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={percentDrafts[a.destinationId] ?? ""}
                    onChange={(e) => setPercentDraft(a.destinationId, e.target.value)}
                  />
                  <span className="text-muted">%</span>
                  <button
                    type="button"
                    className="rounded-xl p-2 text-muted ring-1 ring-white/10 transition hover:text-red-300"
                    aria-label="Remove from split"
                    onClick={() => removeAllocation(a.destinationId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="panel sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 py-3.5 lg:bottom-4">
          <p
            className={`text-sm font-medium tabular-nums ${
              totalOk ? "text-accent" : "text-amber-300"
            }`}
          >
            Total {total.toFixed(2)}%
            {!totalOk && <span className="ml-2 font-normal">· need 100%</span>}
          </p>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save split"}
          </button>
        </div>
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        {message && <InlineAlert tone="success">{message}</InlineAlert>}
      </form>
    </div>
  );
}
