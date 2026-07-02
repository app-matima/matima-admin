import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import type { AdminRole } from "@/types/admin";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: AdminRole[];
}

export const adminNavItems: AdminNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    href: "/planning",
    label: "Planning",
    icon: CalendarDays,
    roles: ["admin", "prestataire"],
  },
  {
    href: "/prestations",
    label: "Prestations",
    icon: ClipboardList,
    roles: ["admin", "prestataire"],
  },
  {
    href: "/mjpms",
    label: "Clients",
    icon: Users,
    roles: ["admin"],
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: ContactRound,
    roles: ["admin", "prestataire"],
  },
  {
    href: "/parametres",
    label: "Paramètres",
    icon: Settings,
    roles: ["admin"],
  },
];

export const prestataireRestrictedPaths = [
  "/dashboard",
  "/mjpms",
  "/clients",
  "/parametres",
] as const;

export function getNavItemsForRole(role: AdminRole): AdminNavItem[] {
  return adminNavItems.filter((item) => item.roles.includes(role));
}

export function isPrestataireRestrictedPath(pathname: string): boolean {
  return prestataireRestrictedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
