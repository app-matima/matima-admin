import { redirect } from "next/navigation";
import { PlanningPageContent } from "@/components/planning/planning-page-content";
import { getAdminUsers } from "@/lib/admin/get-admin-users";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getPlanningData } from "@/lib/planning/get-planning-data";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const [{ prestations, conges }, teamMembers] = await Promise.all([
    getPlanningData(),
    getAdminUsers(),
  ]);

  return (
    <PlanningPageContent
      prestations={prestations}
      conges={conges}
      isAdmin={currentUser.role === "admin"}
      teamMembers={teamMembers}
      currentUserId={currentUser.id}
    />
  );
}
