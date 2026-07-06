import { redirect } from "next/navigation";
import { CourriersPageContent } from "@/components/courriers/courriers-page-content";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getCourriers } from "@/lib/courriers/get-courriers";
import { getHomePathForRole } from "@/lib/navigation/admin-nav-items";

export const dynamic = "force-dynamic";

export default async function CourriersPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (currentUser.role !== "admin" && currentUser.role !== "administratif") {
    redirect(getHomePathForRole(currentUser.role));
  }

  const courriers = await getCourriers();

  return <CourriersPageContent courriers={courriers} />;
}
