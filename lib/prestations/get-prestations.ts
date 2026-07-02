import { createAdminClient } from "@/lib/supabase/server";
import type { PrestationAvecRelations } from "@/types";

export async function getAllPrestations(): Promise<PrestationAvecRelations[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("prestations_commandes")
    .select(
      "id, organisation_id, majeur_id, description, date_souhaitee, heure_souhaitee, adresse_intervention, instructions, statut, created_at, majeurs(nom, prenom), organisations(nom)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllPrestations", error);
    return [];
  }

  return (data ?? []) as PrestationAvecRelations[];
}
