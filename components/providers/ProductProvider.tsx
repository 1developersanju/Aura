"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getApi, getDataMode } from "@/lib/api";
import type { ProductMode } from "@/lib/types";

type ProductContextValue = {
  mode: ProductMode;
  ready: boolean;
  refresh: () => Promise<void>;
  setMode: (mode: ProductMode) => Promise<void>;
  isSupermarket: boolean;
  nouns: {
    entry: string;
    entries: string;
    action: string;
    history: string;
    brandLine: string;
  };
};

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ProductMode>("donations");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const cfg = await getApi().getProductConfig();
      setModeState(cfg.mode);
    } catch {
      setModeState("donations");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Demo mode: poll localStorage product changes lightly via focus
  useEffect(() => {
    if (getDataMode() !== "demo") return;
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("aura-product-mode", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("aura-product-mode", onFocus);
    };
  }, [refresh]);

  const value = useMemo<ProductContextValue>(() => {
    const isSupermarket = mode === "supermarket";
    return {
      mode,
      ready,
      refresh,
      async setMode(next) {
        await getApi().setProductMode(next);
        setModeState(next);
        window.dispatchEvent(new Event("aura-product-mode"));
      },
      isSupermarket,
      nouns: isSupermarket
        ? {
            entry: "purchase",
            entries: "purchases",
            action: "Record purchase",
            history: "My purchases",
            brandLine: "Loyalty pool",
          }
        : {
            entry: "donation",
            entries: "donations",
            action: "Donate",
            history: "My donations",
            brandLine: "Blind giving",
          },
    };
  }, [mode, ready, refresh]);

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
}

export function useProduct() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProduct must be used within ProductProvider");
  return ctx;
}
