import { MobilePrestationsList } from "@/components/mobile/MobilePrestationsList";
import { getAllPrestations } from "@/lib/prestations/get-prestations";

export const dynamic = "force-dynamic";

export default async function MobilePrestationsPage() {
  const prestations = await getAllPrestations();

  return <MobilePrestationsList prestations={prestations} />;
}
