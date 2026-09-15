import { redirect } from "next/navigation";
import { MobileClesList } from "@/components/mobile/MobileClesList";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getClesData } from "@/lib/cles/get-cles-data";

export const dynamic = "force-dynamic";

export default async function MobileClesPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (currentUser.role !== "admin") {
    redirect("/m/prestations");
  }

  const groupes = await getClesData();

  return <MobileClesList groupes={groupes} />;
}
