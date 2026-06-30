import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="px-4 py-6 pb-24 lg:pb-6">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
