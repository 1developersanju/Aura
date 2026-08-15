"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user || !isAdmin) {
      router.replace("/admin/login");
    }
  }, [ready, user, isAdmin, router]);

  if (!ready || !user || !isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">
        Checking admin access…
      </div>
    );
  }
  return <>{children}</>;
}
