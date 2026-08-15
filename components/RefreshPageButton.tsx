"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { emitPageRefresh } from "@/lib/page-refresh";

export function RefreshPageButton() {
  const { refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      emitPageRefresh();
      await refreshUser();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="btn-ghost shrink-0 text-sm"
      aria-label="Refresh this page"
      title="Reload this page’s data"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Refreshing…" : "Refresh"}
    </button>
  );
}
