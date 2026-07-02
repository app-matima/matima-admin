import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";

export default async function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  return <AdminLayout currentUser={currentUser}>{children}</AdminLayout>;
}
