import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import type { GedDossier } from "@/types/documents";

const COLONNES_DOSSIER_DEFAUT =
  "id, organisation_id, majeur_id, parent_id, nom, cree_par_ia, created_at";

/**
 * Arborescence GED complète d'un protégé (pagination au-delà de 1 000 lignes).
 */
export async function chargerDossiersProtege(
  majeurId: string,
  options?: {
    organisationId?: string;
    colonnes?: string;
  },
): Promise<GedDossier[]> {
  if (!majeurId) {
    return [];
  }

  const supabase = createAdminClient();
  const colonnes = options?.colonnes ?? COLONNES_DOSSIER_DEFAUT;
  const organisationId = options?.organisationId;

  const dossiers = await chargerToutesLesLignes<GedDossier>(() => {
    let requete = supabase
      .from("ged_dossiers")
      .select(colonnes)
      .eq("majeur_id", majeurId);

    if (organisationId) {
      requete = requete.eq("organisation_id", organisationId);
    }

    return requete;
  });

  return dossiers.sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
  );
}
