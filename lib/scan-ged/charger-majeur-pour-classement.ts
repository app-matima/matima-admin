import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatutMajeur } from "@/types/documents";
import { estStatutMajeur } from "@/lib/scan-ged/majeurs-scan-ged";

export interface MajeurPourClassement {
  id: string;
  nom: string;
  prenom: string;
  organisation_id: string;
  statut: StatutMajeur;
}

/**
 * Vérifie que le protégé appartient à l'organisation du document.
 * Tous les statuts (actif, décédé, mainlevée, archivé) sont acceptés.
 */
export async function chargerMajeurPourClassementScanGed(
  adminClient: SupabaseClient,
  params: {
    majeurId: string;
    organisationId: string;
  },
): Promise<MajeurPourClassement | null> {
  const { data, error } = await adminClient
    .from("majeurs")
    .select("id, nom, prenom, organisation_id, statut")
    .eq("id", params.majeurId)
    .eq("organisation_id", params.organisationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (!estStatutMajeur(data.statut)) {
    return null;
  }

  return {
    id: data.id,
    nom: data.nom,
    prenom: data.prenom,
    organisation_id: data.organisation_id,
    statut: data.statut,
  };
}
