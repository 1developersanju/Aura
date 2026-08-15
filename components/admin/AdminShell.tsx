"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDataMode } from "@/lib/api";
import { releaseLabel } from "@/lib/release";
import { ReleaseFooter } from "@/components/ReleaseFooter";
import {
  adminNavFlat,
  adminNavGroups,
  findAdminNavItem,
  isAdminNavActive,
} from "@/components/admin/admin-nav";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = findAdminNavItem(pathname);
  const dataMode = getDataMode();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.replace("/admin/login");
  }

  const nav = (
    <nav className="flex flex-col gap-6" aria-label="Admin">
      {adminNavGroups.map((group) => (
        <div key={group.id}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/80">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isAdminNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-accent/15 text-accent ring-1 ring-accent/35"
                        : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? "text-accent" : "text-muted group-hover:text-foreground"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium leading-tight">{item.label}</span>
                      <span
                        className={`mt-0.5 block truncate text-[11px] leading-tight ${
                          active ? "text-accent/70" : "text-muted/70"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-full">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[color:var(--background)]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10 text-foreground"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-display text-base text-foreground">
              {current.label}
            </p>
            <p className="truncate text-[11px] text-muted">
              {user?.displayName ?? "Admin"}
              {user?.email ? (
                <span className="text-muted/70"> · {user.email}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted ring-1 ring-white/10"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-white/10 bg-[#0a1210] p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <BrandBlock dataMode={dataMode} />
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:text-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <UserFooter userName={user?.displayName} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1400px] gap-0 lg:min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/8 px-3 py-6 lg:flex xl:w-72">
          <div className="mb-8 px-2">
            <BrandBlock dataMode={dataMode} />
          </div>
          <div className="flex-1 overflow-y-auto px-0 pb-4">{nav}</div>
          <UserFooter userName={user?.displayName} onSignOut={handleSignOut} />
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
          <ReleaseFooter className="mt-10 pb-2 lg:pb-0" />
        </div>
      </div>

      {/* Mobile bottom quick nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[color:var(--background)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Quick admin"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
          {adminNavFlat.slice(0, 5).map((item) => {
            const active = isAdminNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Spacer for bottom nav on mobile */}
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  );
}

function BrandBlock({ dataMode }: { dataMode: string }) {
  return (
    <Link href="/admin" className="group flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/40">
        <span className="font-display text-lg text-accent">A</span>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg tracking-tight text-foreground group-hover:text-accent">
          Aura
        </span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
          Admin · {dataMode === "firebase" ? "Live" : "Demo"}
        </span>
      </span>
    </Link>
  );
}

function UserFooter({
  userName,
  onSignOut,
}: {
  userName?: string;
  onSignOut: () => void;
}) {
  return (
    <div className="mt-auto border-t border-white/8 px-2 pt-4">
      <p className="truncate px-1 text-xs text-muted">{userName ?? "Admin"}</p>
      <p className="mt-1 px-1 text-[10px] tabular-nums tracking-wide text-muted/70">
        {releaseLabel()}
      </p>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/[0.04] hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
