"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignOut } from "./use-sign-out";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prestations", label: "Prestations", icon: ClipboardList },
  { href: "/mjpms", label: "Clients", icon: Users },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const signOut = useSignOut();

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar">
      <div className="flex h-16 items-center px-6">
        <span className="text-lg font-semibold text-white">Matima Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-white"
                  : "text-gray-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
