import { PrestationsPageContent } from "@/components/prestations/prestations-page-content";
import { getAllPrestations } from "@/lib/prestations/get-prestations";

export const dynamic = "force-dynamic";

export default async function PrestationsPage() {
  const prestations = await getAllPrestations();

  return <PrestationsPageContent prestations={prestations} />;
}
