"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Users } from "lucide-react";
import { getApi } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import type { AuraUser } from "@/lib/types";
import {
  AdminLoading,
  EmptyState,
  InlineAlert,
  PageHeader,
} from "@/components/admin/ui";

type TreeNode = {
  user: AuraUser;
  children: TreeNode[];
  descendantCount: number;
};

function countDescendants(node: TreeNode): number {
  let n = node.children.length;
  for (const c of node.children) n += countDescendants(c);
  return n;
}

function buildForest(users: AuraUser[]): {
  forest: TreeNode[];
  childrenMap: Record<string, AuraUser[]>;
  byId: Record<string, AuraUser>;
} {
  const byId: Record<string, AuraUser> = {};
  for (const u of users) byId[u.uid] = u;

  const childrenMap: Record<string, AuraUser[]> = {};
  for (const u of users) {
    if (!u.referredBy || !byId[u.referredBy]) continue;
    if (!childrenMap[u.referredBy]) childrenMap[u.referredBy] = [];
    childrenMap[u.referredBy]!.push(u);
  }

  function nodeFor(u: AuraUser, seen: Set<string>): TreeNode {
    if (seen.has(u.uid)) {
      return { user: u, children: [], descendantCount: 0 };
    }
    const nextSeen = new Set(seen);
    nextSeen.add(u.uid);
    const kids = (childrenMap[u.uid] ?? []).map((c) => nodeFor(c, nextSeen));
    const node: TreeNode = { user: u, children: kids, descendantCount: 0 };
    node.descendantCount = countDescendants(node);
    return node;
  }

  const roots = users.filter((u) => !u.referredBy || !byId[u.referredBy]);
  const withKids = roots.filter((u) => (childrenMap[u.uid]?.length ?? 0) > 0);
  const list = (withKids.length ? withKids : roots).filter((u) => u.role !== "admin");
  const forest = (list.length ? list : roots).map((u) => nodeFor(u, new Set()));

  return { forest, childrenMap, byId };
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onFocus,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const u = node.user;
  const hasKids = node.children.length > 0;
  const isOpen = expanded.has(u.uid);

  return (
    <div className="relative">
      {depth > 0 && (
        <span
          aria-hidden
          className="absolute left-[-1.1rem] top-5 h-px w-4 bg-white/15"
        />
      )}
      <div className="group flex items-stretch gap-2 rounded-xl border border-white/8 bg-[color:var(--panel)] transition hover:border-accent/30">
        <button
          type="button"
          disabled={!hasKids}
          onClick={() => hasKids && onToggle(u.uid)}
          className={`flex w-10 shrink-0 items-center justify-center rounded-l-xl border-r border-white/8 ${
            hasKids
              ? "text-accent hover:bg-accent/10"
              : "cursor-default text-muted/40"
          }`}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {hasKids ? (
            <motion.span
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="inline-flex"
            >
              <ChevronRight className="h-4 w-4" />
            </motion.span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onFocus(u.uid)}
          className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-3 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{u.displayName}</span>
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
              Tier {u.tier}
            </span>
            {hasKids && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                <Users className="h-3 w-3" />
                {node.children.length} direct · {node.descendantCount} downline
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted">
            {u.email} · lifetime {formatPaise(u.lifetimePaise)} · reinvest{" "}
            {formatPaise(u.reinvestPaise)} · referral earn{" "}
            {formatPaise(u.referralEarnPaise)}
          </p>
          <p className="text-[10px] text-muted/80">
            Level {depth}
            {hasKids ? " · click name to drill into branch" : " · leaf"}
          </p>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {hasKids && isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mt-2 space-y-2 border-l border-accent/20 pl-4">
              {node.children.map((child) => (
                <TreeRow
                  key={child.user.uid}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  onFocus={onFocus}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.user.uid === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function buildPath(
  users: AuraUser[],
  byId: Record<string, AuraUser>,
  focusId: string
): AuraUser[] {
  const path: AuraUser[] = [];
  let cur: AuraUser | undefined = byId[focusId];
  const guard = new Set<string>();
  while (cur && !guard.has(cur.uid)) {
    guard.add(cur.uid);
    path.unshift(cur);
    cur = cur.referredBy ? byId[cur.referredBy] : undefined;
  }
  return path;
}

export default function AdminPoolTreePage() {
  const [users, setUsers] = useState<AuraUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">(
    "info"
  );

  async function reload() {
    setUsers(await getApi().listUsers());
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  const { forest, byId } = useMemo(() => buildForest(users), [users]);

  const orphanRoots = useMemo(() => {
    return users.filter((u) => u.role !== "admin" && !u.referredBy).length;
  }, [users]);

  const focusNode = useMemo(() => {
    if (!focusId) return null;
    return findNode(forest, focusId);
  }, [forest, focusId]);

  const breadcrumb = useMemo(() => {
    if (!focusId) return [];
    return buildPath(users, byId, focusId);
  }, [focusId, users, byId]);

  const displayRoots = focusNode ? [focusNode] : forest;

  useEffect(() => {
    if (forest.length === 0) return;
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const r of forest) next.add(r.user.uid);
      return next;
    });
  }, [forest]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function focus(id: string) {
    setFocusId(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function expandAllUnder(node: TreeNode) {
    setExpanded((prev) => {
      const next = new Set(prev);
      const walk = (n: TreeNode) => {
        next.add(n.user.uid);
        n.children.forEach(walk);
      };
      walk(node);
      return next;
    });
  }

  async function rebuildTree() {
    setRebuilding(true);
    setMessage(null);
    try {
      const { updated } = await getApi().rebuildSpilloverTree();
      setFocusId(null);
      setExpanded(new Set());
      await reload();
      setMessageTone("success");
      setMessage(
        updated === 0
          ? "Tree already matched spillover order."
          : `Rebuilt — updated ${updated} member(s).`
      );
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Rebuild failed");
    } finally {
      setRebuilding(false);
    }
  }

  if (loading) return <AdminLoading label="Loading network tree…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Network tree"
        description="Expand with the chevron, or click a member to drill into their branch. Max 5 directs, then spillover."
        actions={
          <>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={rebuilding}
              onClick={rebuildTree}
            >
              {rebuilding ? "Rebuilding…" : "Rebuild tree"}
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => {
                setFocusId(null);
                const next = new Set<string>();
                for (const r of forest) next.add(r.user.uid);
                setExpanded(next);
              }}
            >
              All roots
            </button>
            {focusNode && (
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => expandAllUnder(focusNode)}
              >
                Expand branch
              </button>
            )}
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => setExpanded(new Set())}
            >
              Collapse
            </button>
          </>
        }
      />

      {orphanRoots > 1 && (
        <InlineAlert tone="warn">
          {orphanRoots} members look like separate roots (often created before
          auto-placement). Use <strong>Rebuild tree</strong> so later accounts nest
          under the first member.
        </InlineAlert>
      )}
      {message && <InlineAlert tone={messageTone}>{message}</InlineAlert>}

      {breadcrumb.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-muted hover:bg-white/5 hover:text-accent"
            onClick={() => setFocusId(null)}
          >
            Network
          </button>
          {breadcrumb.map((u, i) => (
            <span key={u.uid} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted" />
              <button
                type="button"
                className={`rounded-lg px-2 py-1 ${
                  i === breadcrumb.length - 1
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-white/5 hover:text-foreground"
                }`}
                onClick={() => focus(u.uid)}
              >
                {u.displayName}
              </button>
            </span>
          ))}
        </nav>
      )}

      {displayRoots.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="The network appears when donors sign up."
        />
      ) : (
        <div className="space-y-2">
          {displayRoots.map((n) => (
            <TreeRow
              key={n.user.uid}
              node={n}
              depth={focusId ? Math.max(0, breadcrumb.length - 1) : 0}
              expanded={expanded}
              onToggle={toggle}
              onFocus={focus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
