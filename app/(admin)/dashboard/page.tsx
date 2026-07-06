import { redirect } from "next/navigation";
import { DernieresPrestations } from "@/components/dashboard/dernieres-prestations";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { NouveauxClients } from "@/components/dashboard/nouveaux-clients";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";
import { getHomePathForRole } from "@/lib/navigation/admin-nav-items";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (currentUser.role !== "admin") {
    redirect(getHomePathForRole(currentUser.role));
  }

  const { metrics, dernieresPrestations, nouveauxClients } =
    await getDashboardData();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Dashboard Admin
      </h1>

      <MetricCards
        prestationsEnAttente={metrics.prestationsEnAttente}
        prestationsEnCours={metrics.prestationsEnCours}
        clientsActifs={metrics.clientsActifs}
        protegesTotal={metrics.protegesTotal}
      />

      <div className="space-y-6">
        <DernieresPrestations prestations={dernieresPrestations} />
        <NouveauxClients clients={nouveauxClients} />
      </div>
    </div>
  );
}
