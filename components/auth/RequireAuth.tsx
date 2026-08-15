"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

function hardReplace(href: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname + window.location.search === href) return;
  window.location.replace(href);
}

/** Donor-only routes — admins are sent to the admin panel. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready, isAdmin } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      hardReplace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (isAdmin) {
      hardReplace("/admin");
    }
  }, [ready, user, isAdmin]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">Loading…</div>
    );
  }
  if (!user || isAdmin) return null;
  return <>{children}</>;
}
