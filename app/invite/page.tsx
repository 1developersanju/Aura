"use client";

import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { MAX_DIRECTS } from "@/lib/placement";

function InvitePanel() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const link = useMemo(() => {
    if (!user || typeof window === "undefined") return "";
    return `${window.location.origin}/signup?ref=${user.referralCode}`;
  }, [user]);

  async function copy(kind: "link" | "code", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl text-foreground">Grow the network</h1>
      <p className="mt-2 text-sm text-muted">
        New members are placed automatically (up to {MAX_DIRECTS} under each
        person, then spillover deeper). Sharing your link prefers you as sponsor
        when you still have an open slot.
      </p>
      <div className="panel mt-8 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Your code</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 font-mono text-lg tracking-widest text-accent">
              {user.referralCode}
            </code>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => copy("code", user.referralCode)}
            >
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Invite link</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input className="input flex-1 text-sm" readOnly value={link} />
            <button type="button" className="btn-primary" onClick={() => copy("link", link)}>
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <RequireAuth>
      <InvitePanel />
    </RequireAuth>
  );
}
