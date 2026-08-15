import {
  GitBranch,
  LayoutDashboard,
  Percent,
  Receipt,
  Settings2,
  SlidersHorizontal,
  Target,
  Armchair,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "monitor",
    label: "Monitor",
    items: [
      {
        href: "/admin",
        label: "Overview",
        short: "Home",
        description: "Pool volume, wallets, and trends",
        icon: LayoutDashboard,
      },
      {
        href: "/admin/ledger",
        label: "Ledger",
        short: "Ledger",
        description: "Every entry and its 4-way split",
        icon: Receipt,
      },
      {
        href: "/admin/pool-tree",
        label: "House seating",
        short: "House",
        description: "Theatre seating and member split analytics",
        icon: Armchair,
      },
    ],
  },
  {
    id: "allocate",
    label: "Allocate",
    items: [
      {
        href: "/admin/split",
        label: "Charity split",
        short: "Split",
        description: "Where the charity 25% goes",
        icon: Percent,
      },
      {
        href: "/admin/destinations",
        label: "Destinations",
        short: "Causes",
        description: "Purposes and partner charities",
        icon: Target,
      },
      {
        href: "/admin/pool",
        label: "Pool settings",
        short: "Pool",
        description: "Depth, protocol, and tiers",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        href: "/admin/referrals",
        label: "Referrals",
        short: "Refs",
        description: "Invite edges and referral tree",
        icon: GitBranch,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        short: "More",
        description: "Product mode and admin access",
        icon: Settings2,
      },
    ],
  },
];

export const adminNavFlat = adminNavGroups.flatMap((g) => g.items);

export function findAdminNavItem(pathname: string): AdminNavItem {
  const exact = adminNavFlat.find((item) => item.href === pathname);
  if (exact) return exact;
  const nested = adminNavFlat
    .filter((item) => item.href !== "/admin" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return nested ?? adminNavFlat[0]!;
}

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
