import { redirect } from "next/navigation";
import { TvaPageContent } from "@/components/finances/tva-page-content";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getHomePathForRole } from "@/lib/navigation/admin-nav-items";
import { getTvaEstimationAnneeEnCours } from "@/lib/finances/get-tva-estimation";

export const dynamic = "force-dynamic";

export default async function TvaPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (currentUser.role !== "admin") {
    redirect(getHomePathForRole(currentUser.role));
  }

  let estimation;

  try {
    estimation = await getTvaEstimationAnneeEnCours();
  } catch (error) {
    console.error("TvaPage", error);

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium tracking-tight text-text-strong">
          Estimation TVA
        </h1>
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
          <p className="text-sm text-[#991B1B]">
            Impossible de charger l&apos;estimation TVA depuis Pennylane.
            {error instanceof Error ? ` ${error.message}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return <TvaPageContent estimation={estimation} />;
}
