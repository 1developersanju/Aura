"use client";

import { useEffect } from "react";

const PAGE_REFRESH_EVENT = "aura:refresh-page";

/** Ask the current page to reload its data — no full browser refresh. */
export function emitPageRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PAGE_REFRESH_EVENT));
}

/** Load once on mount, and again whenever a page refresh is requested. */
export function usePageRefresh(load: () => void | Promise<void>): void {
  useEffect(() => {
    void load();
    const onRefresh = () => {
      void load();
    };
    window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
  }, [load]);
}
