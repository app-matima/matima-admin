"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/m/prestations",
    label: "Prestations",
    icon: Briefcase,
    match: (pathname: string) => pathname.startsWith("/m/prestations"),
  },
  {
    href: "/m/planning",
    label: "Planning",
    icon: CalendarDays,
    match: (pathname: string) => pathname.startsWith("/m/planning"),
  },
  {
    href: "/m/cles",
    label: "Clés",
    icon: KeyRound,
    match: (pathname: string) => pathname.startsWith("/m/cles"),
  },
] as const;

/** Barre d'onglets bas d'écran — coquille navigation mobile PWA. */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Navigation mobile"
    >
      <ul className="mx-auto flex h-14 max-w-lg items-stretch">
        {TABS.map((tab) => {
          const actif = tab.match(pathname);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                  actif
                    ? "font-medium text-accent"
                    : "text-text-muted hover:text-text-strong",
                )}
                aria-current={actif ? "page" : undefined}
              >
                <Icon
                  className={cn("h-5 w-5", actif ? "text-accent" : "")}
                  strokeWidth={actif ? 2.25 : 1.75}
                  aria-hidden
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
