"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Gift,
  HeartHandshake,
  LogIn,
  LogOut,
  Receipt,
  Share2,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProduct } from "@/components/providers/ProductProvider";

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, mode, signOut } = useAuth();
  const { nouns, isSupermarket } = useProduct();

  // Admin portal uses its own shell.
  if (pathname.startsWith("/admin")) return null;

  const links = [
    {
      href: "/",
      label: "Home",
      icon: isSupermarket ? ShoppingBag : HeartHandshake,
    },
    { href: "/donate", label: nouns.action, icon: Gift },
    { href: "/donations", label: nouns.history, icon: Receipt },
    { href: "/invite", label: "Invite", icon: Share2 },
  ];

  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <Link href="/" className="group flex items-center gap-2">
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-accent/20 ring-1 ring-accent/40">
            <span className="font-display text-lg text-accent">A</span>
          </span>
          <div className="leading-tight">
            <p className="font-display text-lg tracking-tight text-foreground">Aura</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
              {ready ? (mode === "firebase" ? "Live" : "Demo") : "…"} · {nouns.brandLine}
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="relative rounded-xl px-3 py-2 text-sm text-muted transition hover:text-foreground"
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-white/8 ring-1 ring-white/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-[140px] truncate text-xs text-muted sm:inline">
                {user.displayName}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted ring-1 ring-white/10 transition hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Link>
          )}
        </div>
      </nav>

      <div className="mx-auto mt-2 flex max-w-6xl justify-center gap-1 overflow-x-auto md:hidden">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${
                active ? "bg-white/10 text-foreground" : "text-muted"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
