import { createAdminClient } from "@/lib/supabase/server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type { PrestationAvecRelations } from "@/types";

export async function getAllPrestations(): Promise<PrestationAvecRelations[]> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("prestations_commandes")
    .select(
      "id, organisation_id, majeur_id, description, date_souhaitee, heure_souhaitee, adresse_intervention, instructions, statut, prestataire_id, attestation_url, created_at, majeurs(nom, prenom), organisations(nom)",
    )
    .in("organisation_id", organisationIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllPrestations", error);
    return [];
  }

  return (data ?? []) as PrestationAvecRelations[];
}
