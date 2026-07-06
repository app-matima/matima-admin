import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardList,
  ContactRound,
  FileScan,
  KeyRound,
  LayoutDashboard,
  Mail,
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

/** Navigation admin — tous les items avec leurs rôles autorisés */
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
    href: "/cles",
    label: "Clés",
    icon: KeyRound,
    roles: ["admin"],
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: ContactRound,
    roles: ["admin", "prestataire"],
  },
  {
    href: "/courriers",
    label: "Courriers",
    icon: Mail,
    roles: ["admin", "administratif"],
  },
  {
    href: "/scan-ged",
    label: "Scan GED",
    icon: FileScan,
    roles: ["admin", "administratif"],
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
  "/cles",
  "/parametres",
  "/courriers",
  "/scan-ged",
] as const;

export const administratifRestrictedPaths = [
  "/dashboard",
  "/clients",
  "/mjpms",
  "/parametres",
  "/prestations",
  "/planning",
  "/contacts",
  "/cles",
] as const;

export const PRESTATAIRE_HOME_PATH = "/prestations";
export const ADMINISTRATIF_HOME_PATH = "/courriers";

const navOrderByRole: Partial<Record<AdminRole, string[]>> = {
  prestataire: ["/prestations", "/planning", "/contacts"],
  administratif: ["/courriers", "/scan-ged"],
};

export function getNavItemsForRole(role: AdminRole): AdminNavItem[] {
  const items = adminNavItems.filter((item) => item.roles.includes(role));
  const order = navOrderByRole[role];

  if (order) {
    return [...items].sort(
      (a, b) => order.indexOf(a.href) - order.indexOf(b.href),
    );
  }

  return items;
}

export function isPrestataireRestrictedPath(pathname: string): boolean {
  return prestataireRestrictedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isAdministratifRestrictedPath(pathname: string): boolean {
  return administratifRestrictedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getHomePathForRole(role: AdminRole): string {
  switch (role) {
    case "prestataire":
      return PRESTATAIRE_HOME_PATH;
    case "administratif":
      return ADMINISTRATIF_HOME_PATH;
    default:
      return "/dashboard";
  }
}
