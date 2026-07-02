import { EquipeSection } from "@/components/parametres/equipe-section";
import { MonCompteSection } from "@/components/parametres/mon-compte-section";
import type { AdminUser } from "@/types/admin";

interface ParametresPageContentProps {
  currentUser: AdminUser;
  users: AdminUser[];
}

export function ParametresPageContent({
  currentUser,
  users,
}: ParametresPageContentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Paramètres
      </h1>

      <EquipeSection
        users={users}
        isAdmin={currentUser.role === "admin"}
      />
      <MonCompteSection user={currentUser} />
    </div>
  );
}
