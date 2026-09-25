import type { SupabaseClient } from "@supabase/supabase-js";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";

const DOSSIER_PRESTATIONS_NOM = "Prestations";

/**
 * Résout ou crée le dossier GED racine « Prestations » pour un protégé.
 * Même principe que creerOuRecupererDossier (matima-app).
 */
export async function getOrCreateDossierPrestationsGed(
  supabase: SupabaseClient,
  params: {
    organisationId: string;
    majeurId: string;
  },
): Promise<string> {
  const existants = await chargerToutesLesLignes<{ id: string; nom: string }>(
    () =>
      supabase
        .from("ged_dossiers")
        .select("id, nom")
        .eq("organisation_id", params.organisationId)
        .eq("majeur_id", params.majeurId)
        .is("parent_id", null),
  );

  const dejaPresent = existants.find(
    (dossier) =>
      dossier.nom.toLowerCase() === DOSSIER_PRESTATIONS_NOM.toLowerCase(),
  );

  if (dejaPresent) {
    return dejaPresent.id;
  }

  const { data: cree, error: creationError } = await supabase
    .from("ged_dossiers")
    .insert({
      organisation_id: params.organisationId,
      majeur_id: params.majeurId,
      parent_id: null,
      nom: DOSSIER_PRESTATIONS_NOM,
      cree_par_ia: false,
    })
    .select("id")
    .single();

  if (creationError || !cree) {
    throw new Error(
      creationError?.message ??
        `Impossible de créer le dossier « ${DOSSIER_PRESTATIONS_NOM} ».`,
    );
  }

  return cree.id as string;
}
