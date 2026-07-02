"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItemsForRole } from "@/lib/navigation/admin-nav-items";
import type { AdminUser } from "@/types/admin";
import { useSignOut } from "./use-sign-out";

interface BottomNavProps {
  currentUser: AdminUser;
}

export function BottomNav({ currentUser }: BottomNavProps) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const navItems = getNavItemsForRole(currentUser.role);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-white">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
              isActive ? "text-accent" : "text-text-muted",
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={signOut}
        className="flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:text-accent"
      >
        <LogOut className="h-5 w-5" />
        <span>Quitter</span>
      </button>
    </nav>
  );
}
