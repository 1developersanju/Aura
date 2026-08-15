"use client";

import { FormEvent, useEffect, useState } from "react";
import { getApi } from "@/lib/api";
import type { Destination, DestinationKind } from "@/lib/types";
import {
  AdminLoading,
  EmptyState,
  InlineAlert,
  PageHeader,
  Section,
} from "@/components/admin/ui";

export default function AdminDestinationsPage() {
  const [items, setItems] = useState<Destination[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DestinationKind>("purpose");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setItems(await getApi().listDestinations());
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await getApi().createDestination({ name, kind });
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  }

  async function toggleActive(dest: Destination) {
    await getApi().updateDestination(dest.id, { active: !dest.active });
    await reload();
  }

  async function rename(dest: Destination) {
    const next = window.prompt("Rename destination", dest.name);
    if (!next?.trim()) return;
    await getApi().updateDestination(dest.id, { name: next.trim() });
    await reload();
  }

  if (loading) return <AdminLoading label="Loading destinations…" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Destinations"
        description="Purposes and charities share one pool — both appear in the charity split."
      />

      <Section title="Add destination">
        <form onSubmit={onCreate} className="panel space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="input"
              placeholder="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as DestinationKind)}
            >
              <option value="purpose">Purpose</option>
              <option value="charity">Charity</option>
            </select>
            <button type="submit" className="btn-primary">
              Add
            </button>
          </div>
          {error && <InlineAlert tone="error">{error}</InlineAlert>}
        </form>
      </Section>

      <Section title="All destinations" description={`${items.length} total`}>
        {items.length === 0 ? (
          <EmptyState
            title="No destinations yet"
            description="Add a purpose or charity above to start splitting funds."
          />
        ) : (
          <div className="space-y-2">
            {items.map((dest) => (
              <div
                key={dest.id}
                className="panel flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{dest.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 uppercase tracking-wider text-muted">
                      {dest.kind}
                    </span>
                    <span
                      className={
                        dest.active ? "text-accent" : "text-muted"
                      }
                    >
                      {dest.active ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => rename(dest)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => toggleActive(dest)}
                  >
                    {dest.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
