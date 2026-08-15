"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/** Donor-only routes — admins are sent to the admin panel. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isAdmin) {
      router.replace("/admin");
    }
  }, [ready, user, isAdmin, pathname, router]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">Loading…</div>
    );
  }
  if (!user || isAdmin) return null;
  return <>{children}</>;
}
