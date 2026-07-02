import { ClientsPageContent } from "@/components/clients/clients-page-content";
import { getAllClients } from "@/lib/clients/get-organisations";

export const dynamic = "force-dynamic";

export default async function MjpmsPage() {
  const clients = await getAllClients();

  return <ClientsPageContent clients={clients} />;
}
