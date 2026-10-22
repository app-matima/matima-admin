import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type { AdminUser } from "@/types/admin";

export async function requireScanGedAccess(): Promise<AdminUser | null> {
  const currentUser = await getCurrentAdminUser();

  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "administratif")
  ) {
    return null;
  }

  return currentUser;
}

/**
 * Admin/administratif + organisation non-démo connue.
 *
 * Note : `requireScanGedAccess` ne lie PAS l'admin à une organisation —
 * tout admin Matima peut agir sur toute org non-démo (comportement produit).
 * Cette helper centralise le contrôle org = paramètre d'URL, jamais le body.
 */
export async function requireScanGedOrganisationAccess(
  organisationId: string,
): Promise<
  | { ok: true; admin: AdminUser }
  | { ok: false; status: 403 | 400 | 404; error: string }
> {
  const admin = await requireScanGedAccess();
  if (!admin) {
    return { ok: false, status: 403, error: "Action non autorisée." };
  }

  if (!organisationId?.trim()) {
    return { ok: false, status: 400, error: "Organisation requise." };
  }

  const organisationIds = await getNonDemoOrganisationIds();
  if (!organisationIds.includes(organisationId)) {
    return { ok: false, status: 404, error: "Organisation introuvable." };
  }

  return { ok: true, admin };
}
