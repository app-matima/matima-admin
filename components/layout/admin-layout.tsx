import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import type { AdminUser } from "@/types/admin";

interface AdminLayoutProps {
  children: React.ReactNode;
  currentUser: AdminUser;
}

export function AdminLayout({ children, currentUser }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-page">
      <Sidebar currentUser={currentUser} />
      <div className="lg:pl-64">
        <Header />
        <main className="px-4 py-6 pb-24 lg:pb-6">{children}</main>
        <BottomNav currentUser={currentUser} />
      </div>
    </div>
  );
}
