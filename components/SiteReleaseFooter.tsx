"use client";

import { usePathname } from "next/navigation";
import { ReleaseFooter } from "@/components/ReleaseFooter";

/** Customer pages and admin login. Shell pages show the version in AdminShell. */
export function SiteReleaseFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    return null;
  }
  return (
    <ReleaseFooter className="pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-4" />
  );
}
