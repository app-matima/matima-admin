import { createAdminClient } from "@/lib/supabase/server";
import {
  addDays,
  dateStringToKey,
  formatDateKey,
  getWeekStart,
} from "@/lib/planning/utils";
import type {
  Conge,
  PlanningPrestation,
  TacheAdmin,
} from "@/types/planning";

export interface PlanningData {
  prestations: PlanningPrestation[];
  conges: Conge[];
}

export interface MobilePlanningWeekData {
  weekStartKey: string;
  weekEndKey: string;
  prestations: PlanningPrestation[];
  taches: TacheAdmin[];
}

const PRESTATION_PLANNING_SELECT =
  "id, organisation_id, majeur_id, description, date_souhaitee, date_acceptee, prestataire_id, heure_souhaitee, adresse_intervention, instructions, statut, devis_storage_path, devis_signe_storage_path, devis_signe_le, created_at, majeurs(nom, prenom), organisations(nom)";

export async function getPlanningData(): Promise<PlanningData> {
  const supabase = createAdminClient();

  const [prestationsResult, congesResult] = await Promise.all([
    supabase
      .from("prestations_commandes")
      .select(PRESTATION_PLANNING_SELECT)
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

/**
 * Prestations + tâches libres pour une semaine (lun→dim).
 * Réutilise les mêmes filtres de prestations que getPlanningData, bornés à la semaine.
 */
export async function getMobilePlanningWeekData(
  weekStartInput?: Date | string,
): Promise<MobilePlanningWeekData> {
  const weekStart =
    typeof weekStartInput === "string"
      ? getWeekStart(
          new Date(
            Number(weekStartInput.slice(0, 4)),
            Number(weekStartInput.slice(5, 7)) - 1,
            Number(weekStartInput.slice(8, 10)),
          ),
        )
      : getWeekStart(weekStartInput ?? new Date());

  const weekStartKey = formatDateKey(weekStart);
  const weekEndKey = formatDateKey(addDays(weekStart, 6));

  const supabase = createAdminClient();

  const [prestationsResult, tachesResult] = await Promise.all([
    supabase
      .from("prestations_commandes")
      .select(PRESTATION_PLANNING_SELECT)
      .in("statut", ["en_attente", "confirme", "en_cours", "realise"])
      .not("date_souhaitee", "is", null)
      .gte("date_souhaitee", weekStartKey)
      .lte("date_souhaitee", weekEndKey)
      .order("date_souhaitee", { ascending: true }),
    supabase
      .from("taches_admin")
      .select("id, admin_user_id, titre, date, notes, created_at")
      .gte("date", weekStartKey)
      .lte("date", weekEndKey)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (prestationsResult.error) {
    console.error(
      "getMobilePlanningWeekData prestations",
      prestationsResult.error,
    );
  }

  if (tachesResult.error) {
    console.error("getMobilePlanningWeekData taches", tachesResult.error);
  }

  const prestations = ((prestationsResult.data ?? []) as PlanningPrestation[]).filter(
    (prestation) => {
      const key = dateStringToKey(prestation.date_souhaitee);
      return key >= weekStartKey && key <= weekEndKey;
    },
  );

  return {
    weekStartKey,
    weekEndKey,
    prestations,
    taches: (tachesResult.data ?? []) as TacheAdmin[],
  };
}
