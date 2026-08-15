"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Armchair, X } from "lucide-react";
import { getApi } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { analyzeMember } from "@/lib/member-analytics";
import { usePageRefresh } from "@/lib/page-refresh";
import { MAX_DIRECTS } from "@/lib/placement";
import { buildTheaterRows, setSwatch, type EmptySeat, type FilledSeat, type SetSwatch } from "@/lib/seating";
import { DEFAULT_TIERS } from "@/lib/pool-config";
import {
  AdminLoading,
  EmptyState,
  InlineAlert,
  PageHeader,
  StatCard,
} from "@/components/admin/ui";

export default function AdminPoolTreePage() {
  const [users, setUsers] = useState<AuraUser[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">(
    "info"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emptyHint, setEmptyHint] = useState<EmptySeat | null>(null);

  const load = useCallback(async () => {
    const api = getApi();
    const [u, e, v] = await Promise.all([
      api.listUsers(),
      api.listEntries(),
      api.listAllVouchers(),
    ]);
    setUsers(u);
    setEntries(e);
    setVouchers(v);
    setLoading(false);
  }, []);

  usePageRefresh(load);

  const byId = useMemo(() => {
    const map: Record<string, AuraUser> = {};
    for (const u of users) map[u.uid] = u;
    return map;
  }, [users]);

  const rows = useMemo(() => buildTheaterRows(users), [users]);
  const selected = selectedId ? byId[selectedId] : null;
  const analytics = useMemo(() => {
    if (!selected) return null;
    return analyzeMember(selected, users, entries, vouchers);
  }, [selected, users, entries, vouchers]);

  async function rebuildTree() {
    setRebuilding(true);
    setMessage(null);
    try {
      const { updated } = await getApi().rebuildSpilloverTree();
      await load();
      setMessageTone("success");
      setMessage(
        updated === 0
          ? "House already matched sequential seating."
          : `Reseated ${updated} member(s) in join order.`
      );
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Rebuild failed");
    } finally {
      setRebuilding(false);
    }
  }

  if (loading) return <AdminLoading label="Loading house seating…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="House seating"
        description={`Complete house: level 0 is 1 seat, level 1 is ${MAX_DIRECTS}, level 2 is ${MAX_DIRECTS ** 2}. Each colour is one set of ${MAX_DIRECTS}. Click a seat for payments and split analytics.`}
        actions={
          <>
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={rebuilding}
              onClick={rebuildTree}
            >
              {rebuilding ? "Reseating…" : "Reseat house"}
            </button>
          </>
        }
      />

      {message && <InlineAlert tone={messageTone}>{message}</InlineAlert>}

      {rows.length === 0 ? (
        <EmptyState
          title="No seats yet"
          description="The house fills when donors sign up."
        />
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-black/25 px-3 py-8 sm:px-6">
          <div className="mx-auto mb-8 max-w-xl text-center">
            <div className="mx-auto h-2 w-[min(100%,28rem)] rounded-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-80 shadow-[0_0_24px_var(--glow)]" />
            <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-accent">
              Stage
            </p>
            <SetLegend rows={rows} byId={byId} />
          </div>

          <div className="space-y-7">
            {rows.map((row) => (
              <div key={row.level} className="space-y-2">
                <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted">
                  Level {row.level}
                  {row.level === 0 ? " · front" : ""} ·{" "}
                  {row.seats.filter((s) => s.kind === "filled").length}/
                  {row.seats.length} seated
                </p>
                <div className="px-2 pb-2">
                  <div
                    className={`flex justify-center gap-1.5 sm:gap-2 ${
                      row.seats.length > 10
                        ? "flex-wrap"
                        : "flex-nowrap overflow-x-auto"
                    }`}
                  >
                    {row.seats.map((seat) =>
                      seat.kind === "filled" ? (
                        <FilledChair
                          key={seat.key}
                          seat={seat}
                          selected={selectedId === seat.user.uid}
                          onSelect={() => {
                            setEmptyHint(null);
                            setSelectedId(seat.user.uid);
                          }}
                        />
                      ) : (
                        <EmptyChair
                          key={seat.key}
                          seat={seat}
                          onSelect={() => {
                            setSelectedId(null);
                            setEmptyHint(seat);
                          }}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {emptyHint && (
        <InlineAlert tone="info">
          Open seat {emptyHint.slot + 1} under{" "}
          <strong>
            {emptyHint.parentUid
              ? byId[emptyHint.parentUid]?.displayName ?? "an open chair above"
              : "the house"}
          </strong>
          . Next joiner in sequence takes the leftmost open chair.
        </InlineAlert>
      )}

      <AnimatePresence>
        {analytics && (
          <MemberDrawer
            analytics={analytics}
            setColor={setSwatch(analytics.user.referredBy ?? "house-root")}
            sponsorName={
              analytics.user.referredBy
                ? byId[analytics.user.referredBy]?.displayName
                : null
            }
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FilledChair({
  seat,
  selected,
  onSelect,
}: {
  seat: FilledSeat;
  selected: boolean;
  onSelect: () => void;
}) {
  const u = seat.user;
  const initial = (u.displayName.trim()[0] ?? "?").toUpperCase();
  const swatch = setSwatch(seat.setId);
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${u.displayName} · ${swatch.name} set · ${u.email}`}
      className={`group w-[3.35rem] shrink-0 text-center sm:w-16 ${
        selected ? "z-10" : ""
      } ${seat.slot === 0 ? "ml-2 sm:ml-3" : ""}`}
    >
      <span
        className="mx-auto block h-2.5 w-9 rounded-t-full sm:w-10"
        style={{ backgroundColor: swatch.fill }}
      />
      <span
        className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${
          selected ? "ring-2 ring-white" : "ring-1 ring-black/20"
        }`}
        style={{
          backgroundColor: swatch.fill,
          color: swatch.ink,
          boxShadow: selected ? `0 0 0 3px ${swatch.fill}66` : undefined,
        }}
      >
        <span className="font-display text-sm">{initial}</span>
      </span>
      <span
        className="mt-1 block truncate text-[9px]"
        style={{ color: selected ? swatch.fill : undefined }}
      >
        {u.displayName}
      </span>
    </button>
  );
}

function EmptyChair({
  seat,
  onSelect,
}: {
  seat: EmptySeat;
  onSelect: () => void;
}) {
  const swatch = setSwatch(seat.setId);
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`Open ${swatch.name} seat`}
      className={`w-[3.35rem] shrink-0 text-center sm:w-16 ${
        seat.slot === 0 ? "ml-2 sm:ml-3" : ""
      }`}
    >
      <span
        className="mx-auto block h-2.5 w-9 rounded-t-full opacity-40 sm:w-10"
        style={{ backgroundColor: swatch.fill }}
      />
      <span
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl opacity-55 sm:h-12 sm:w-12"
        style={{
          boxShadow: `inset 0 0 0 1.5px ${swatch.fill}`,
          color: swatch.fill,
        }}
      >
        <Armchair className="h-4 w-4" />
      </span>
      <span className="mt-1 block text-[9px] text-muted">open</span>
    </button>
  );
}

function SetLegend({
  rows,
  byId,
}: {
  rows: ReturnType<typeof buildTheaterRows>;
  byId: Record<string, AuraUser>;
}) {
  const items = useMemo(() => {
    const seen = new Map<string, { setId: string; label: string }>();
    for (const row of rows) {
      for (const seat of row.seats) {
        if (seen.has(seat.setId)) continue;
        const parentName = seat.parentUid
          ? byId[seat.parentUid]?.displayName
          : null;
        const label =
          seat.setId === "house-root"
            ? "Front row"
            : parentName
              ? `${parentName}’s set`
              : "Open set";
        seen.set(seat.setId, { setId: seat.setId, label });
      }
    }
    return [...seen.values()];
  }, [rows, byId]);

  if (items.length === 0) return null;

  return (
    <ul className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
      {items.map((item) => {
        const swatch = setSwatch(item.setId);
        return (
          <li
            key={item.setId}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: swatch.fill }}
            />
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}

function MemberDrawer({
  analytics,
  sponsorName,
  setColor,
  onClose,
}: {
  analytics: NonNullable<ReturnType<typeof analyzeMember>>;
  sponsorName: string | null | undefined;
  setColor: SetSwatch;
  onClose: () => void;
}) {
  const u = analytics.user;
  const splitRows = [
    ["Ops", analytics.split.opsPaise],
    ["Charity", analytics.split.charityPaise],
    ["Reinvest", analytics.split.reinvestPaise],
    ["Referral slice", analytics.split.referralPaise],
    ["Dust", analytics.split.dustPaise],
  ] as const;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 28, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[#0a1210] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: setColor.fill }}
              />
              {setColor.name} set ·{" "}
              {DEFAULT_TIERS.find((t) => t.tier === u.tier)?.name ?? "Starter"} ·
              tier {u.tier}
            </p>
            <h2 className="font-display text-2xl text-foreground">{u.displayName}</h2>
            <p className="mt-0.5 text-xs text-muted">{u.email}</p>
            {sponsorName && (
              <p className="mt-1 text-xs text-muted">Under {sponsorName}</p>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <StatCard label="Paid in" value={formatPaise(analytics.paidInPaise)} accent />
          <StatCard label="Entries" value={analytics.entryCount} />
          <StatCard label="Reinvest wallet" value={formatPaise(u.reinvestPaise)} />
          <StatCard
            label="Referral earn"
            value={formatPaise(u.referralEarnPaise)}
            hint={`${formatPaise(analytics.voucherOpenPaise)} open voucher`}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {analytics.directs} direct · {analytics.downline} downline · claimed{" "}
          {formatPaise(analytics.voucherClaimedPaise)}
        </p>

        <h3 className="mt-6 font-display text-lg">4-way split of their entries</h3>
        <ul className="mt-2 space-y-1.5">
          {splitRows.map(([label, paise]) => (
            <li
              key={label}
              className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm"
            >
              <span className="text-muted">{label}</span>
              <span className="tabular-nums text-foreground">{formatPaise(paise)}</span>
            </li>
          ))}
        </ul>

        <h3 className="mt-6 font-display text-lg">Charity distribution</h3>
        {analytics.charityByName.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No charity slice yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {analytics.charityByName.map((row) => (
              <li
                key={row.name}
                className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm"
              >
                <span className="text-muted">{row.name}</span>
                <span className="tabular-nums">{formatPaise(row.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 font-display text-lg">Referral out</h3>
        <p className="text-xs text-muted">From this member’s entries to their upline.</p>
        {analytics.paidToUpline.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None (no upline, or no entries).</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {analytics.paidToUpline.map((row) => (
              <li
                key={row.userId}
                className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm"
              >
                <span className="text-muted">{row.name}</span>
                <span className="tabular-nums text-accent">
                  {formatPaise(row.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 font-display text-lg">Referral in</h3>
        <p className="text-xs text-muted">
          Voucher credit from downline entries ·{" "}
          {formatPaise(analytics.receivedTotalPaise)}
        </p>
        {analytics.receivedFromNetwork.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No downline payouts received.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {analytics.receivedFromNetwork.map((row) => (
              <li
                key={row.fromUserId}
                className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm"
              >
                <span className="text-muted">{row.fromName}</span>
                <span className="tabular-nums text-accent">
                  {formatPaise(row.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 font-display text-lg">Payments</h3>
        {analytics.entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No entries recorded.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {analytics.entries.map((e) => (
              <li key={e.id} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-accent">
                    {formatPaise(e.amountPaise)}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                {e.remarks && (
                  <p className="mt-1 text-xs text-accent">{e.remarks}</p>
                )}
                <p className="mt-1 text-[11px] text-muted">
                  ops {formatPaise(e.fourWay.opsPaise)} · charity{" "}
                  {formatPaise(e.fourWay.charityPaise)} · reinvest{" "}
                  {formatPaise(e.fourWay.reinvestPaise)} · referral{" "}
                  {formatPaise(e.fourWay.referralPaise)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </motion.aside>
    </motion.div>
  );
}
