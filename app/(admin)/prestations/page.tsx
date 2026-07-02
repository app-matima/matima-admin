import { redirect } from "next/navigation";
import { PrestationsPageContent } from "@/components/prestations/prestations-page-content";
import { PrestationsPrestataireContent } from "@/components/prestations/prestations-prestataire-content";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getAllPrestations } from "@/lib/prestations/get-prestations";

export const dynamic = "force-dynamic";

export default async function PrestationsPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
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

  return <PrestationsPageContent prestations={prestations} />;
}
