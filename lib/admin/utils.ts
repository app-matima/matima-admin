import type { BadgeVariant } from "@/components/shared/badge";
import type { AdminRole } from "@/types/admin";

export function getAdminRoleLabel(role: AdminRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "prestataire":
      return "Prestataire";
    default:
      return role;
  }
}

export function getAdminRoleBadgeVariant(role: AdminRole): BadgeVariant {
  switch (role) {
    case "admin":
      return "info";
    case "prestataire":
      return "neutral";
    default:
      return "neutral";
  }
}

export function getAdminNomComplet(
  user: Pick<AdminUserFields, "prenom" | "nom">,
): string {
  return `${user.prenom} ${user.nom}`.trim();
}

export function getAdminUserLabel(
  userId: string | null | undefined,
  users: Pick<AdminUserFields, "id" | "prenom" | "nom">[],
): string {
  if (!userId) {
    return "Non assigné";
  }

  const user = users.find((member) => member.id === userId);

  if (!user) {
    return "Non assigné";
  }

  return getAdminNomComplet(user);
}

interface AdminUserFields {
  id: string;
  prenom: string;
  nom: string;
}
