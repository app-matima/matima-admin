import { redirect } from "next/navigation";
import { ScanGedPageContent } from "@/components/scan-ged/scan-ged-page-content";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getHomePathForRole } from "@/lib/navigation/admin-nav-items";
import { getScanGedOrganisations } from "@/lib/scan-ged/get-organisations";

export const dynamic = "force-dynamic";

export default async function ScanGedPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (currentUser.role !== "admin" && currentUser.role !== "administratif") {
    redirect(getHomePathForRole(currentUser.role));
  }

  const organisations = await getScanGedOrganisations();

  return <ScanGedPageContent organisations={organisations} />;
}
