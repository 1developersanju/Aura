"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * Hard navigation avoids Next's "Router action dispatched before initialization"
 * which can fire when useRouter().replace runs during Fast Refresh / early hydrate.
 */
function hardReplace(href: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  window.location.replace(href);
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready, isAdmin } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user || !isAdmin) {
      hardReplace("/admin/login");
    }
  }, [ready, user, isAdmin]);

  if (!ready || !user || !isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">
        Checking admin access…
      </div>
    );
  }
  return <>{children}</>;
}
