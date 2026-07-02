import { createAdminClient } from "@/lib/supabase/server";
import type { Conge, PlanningPrestation } from "@/types/planning";

export interface PlanningData {
  prestations: PlanningPrestation[];
  conges: Conge[];
}

export async function getPlanningData(): Promise<PlanningData> {
  const supabase = createAdminClient();

  const [prestationsResult, congesResult] = await Promise.all([
    supabase
      .from("prestations_commandes")
      .select(
        "id, organisation_id, majeur_id, description, date_souhaitee, date_acceptee, prestataire_id, heure_souhaitee, adresse_intervention, instructions, statut, created_at, majeurs(nom, prenom), organisations(nom)",
      )
      .in("statut", ["en_attente", "confirme", "en_cours", "realise"])
      .not("date_souhaitee", "is", null)
      .order("date_souhaitee", { ascending: true }),
    supabase
      .from("conges")
      .select("id, admin_user_id, titre, date_debut, date_fin, notes")
      .order("date_debut", { ascending: true }),
  ]);

  if (prestationsResult.error) {
    console.error("getPlanningData prestations", prestationsResult.error);
  }

  if (congesResult.error) {
    console.error("getPlanningData conges", congesResult.error);
  }

  return {
    prestations: (prestationsResult.data ?? []) as PlanningPrestation[],
    conges: (congesResult.data ?? []) as Conge[],
  };
}
