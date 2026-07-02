import { ClientsPageContent } from "@/components/clients/clients-page-content";
import {
  getAllClients,
  getAllPlans,
} from "@/lib/clients/get-organisations";

export const dynamic = "force-dynamic";

export default async function MjpmsPage() {
  const [clients, plans] = await Promise.all([
    getAllClients(),
    getAllPlans(),
  ]);

  return <ClientsPageContent clients={clients} plans={plans} />;
}
