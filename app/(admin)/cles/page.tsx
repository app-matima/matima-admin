import { redirect } from "next/navigation";
import { ClesPageContent } from "@/components/cles/cles-page-content";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getClesData } from "@/lib/cles/get-cles-data";

export const dynamic = "force-dynamic";

export default async function ClesPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (currentUser.role !== "admin") {
    redirect("/prestations");
  }

  const groupes = await getClesData();

  return <ClesPageContent groupes={groupes} />;
}
