"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { getApi } from "@/lib/api";
import { usePageRefresh } from "@/lib/page-refresh";
import type { AuraUser } from "@/lib/types";
import {
  AdminLoading,
  EmptyState,
  PageHeader,
  Section,
} from "@/components/admin/ui";

export default function AdminReferralsPage() {
  const [users, setUsers] = useState<AuraUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setUsers(await getApi().listUsers());
    setLoading(false);
  }, []);

  usePageRefresh(load);

  const byId = useMemo(() => {
    const map: Record<string, AuraUser> = {};
    for (const u of users) map[u.uid] = u;
    return map;
  }, [users]);

  const edges = useMemo(
    () =>
      users
        .filter((u) => u.referredBy)
        .map((u) => ({
          invitee: u,
          inviter: byId[u.referredBy!],
        })),
    [users, byId]
  );

  const tree = useMemo(() => {
    const children: Record<string, AuraUser[]> = {};
    for (const u of users) {
      if (!u.referredBy) continue;
      if (!children[u.referredBy]) children[u.referredBy] = [];
      children[u.referredBy]!.push(u);
    }
    for (const kids of Object.values(children)) {
      kids.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    const roots = users
      .filter((u) => (children[u.uid]?.length ?? 0) > 0 && !u.referredBy)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { children, roots };
  }, [users]);

  if (loading) return <AdminLoading label="Loading referrals…" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Referrals"
        description="Tree parents follow sequential join-order placement. For the full house, use House seating."
        actions={
          <Link href="/admin/pool-tree" className="btn-ghost text-sm">
            Open house seating
          </Link>
        }
      />

      <Section title="Referral list" description={`${edges.length} invite links`}>
        {edges.length === 0 ? (
          <EmptyState
            title="No referral signups yet"
            description="When someone joins via spillover or invite code, they’ll show here."
          />
        ) : (
          <div className="space-y-2">
            {edges.map(({ invitee, inviter }) => (
              <div
                key={invitee.uid}
                className="panel flex flex-wrap items-center justify-between gap-2 py-3.5 text-sm"
              >
                <span>
                  <span className="font-medium text-accent">
                    {inviter?.displayName ?? "Unknown"}
                  </span>
                  <span className="text-muted"> → </span>
                  <span className="text-foreground">{invitee.displayName}</span>
                </span>
                <span className="text-xs text-muted">
                  {new Date(invitee.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Referral tree">
        {tree.roots.length === 0 ? (
          <EmptyState
            title="Tree is empty"
            description="It appears once members have downlines."
          />
        ) : (
          <div className="space-y-3">
            {tree.roots.map((root) => (
              <div key={root.uid} className="panel">
                <p className="font-medium text-accent">{root.displayName}</p>
                <ul className="mt-2 space-y-1 border-l border-white/10 pl-4 text-sm text-muted">
                  {(tree.children[root.uid] ?? []).map((child) => (
                    <li key={child.uid}>
                      {child.displayName}
                      {(tree.children[child.uid]?.length ?? 0) > 0 && (
                        <ul className="mt-1 space-y-1 border-l border-white/10 pl-4">
                          {tree.children[child.uid]!.map((grand) => (
                            <li key={grand.uid}>{grand.displayName}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
