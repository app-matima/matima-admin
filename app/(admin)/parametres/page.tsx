import { redirect } from "next/navigation";
import { ParametresPageContent } from "@/components/parametres/parametres-page-content";
import { getAdminUsers } from "@/lib/admin/get-admin-users";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const users = await getAdminUsers();

  return (
    <ParametresPageContent currentUser={currentUser} users={users} />
  );
}
