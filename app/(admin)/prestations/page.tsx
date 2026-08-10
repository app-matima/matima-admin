import { redirect } from "next/navigation";
import { PrestationsPageContent } from "@/components/prestations/prestations-page-content";
import { PrestationsPrestataireContent } from "@/components/prestations/prestations-prestataire-content";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getHomePathForRole } from "@/lib/navigation/admin-nav-items";
import { getAllPrestations } from "@/lib/prestations/get-prestations";

export const dynamic = "force-dynamic";

export default async function PrestationsPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (
    currentUser.role !== "admin" &&
    currentUser.role !== "prestataire" &&
    currentUser.role !== "administratif"
  ) {
    redirect(getHomePathForRole(currentUser.role));
  }

  const prestations = await getAllPrestations();

  if (currentUser.role === "prestataire") {
    return (
      <PrestationsPrestataireContent
        prestations={prestations}
        currentUserId={currentUser.id}
      />
    );
  }

  if (currentUser.role === "administratif") {
    const prestationsRealisees = prestations.filter(
      (prestation) => prestation.statut === "realise",
    );

    return (
      <PrestationsPageContent
        prestations={prestationsRealisees}
        mode="facturation"
      />
    );
  }

  return <PrestationsPageContent prestations={prestations} mode="full" />;
}
