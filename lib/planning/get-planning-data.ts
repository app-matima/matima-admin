import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
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

  try {
    const [prestations, conges] = await Promise.all([
      chargerToutesLesLignes<PlanningPrestation>(() =>
        supabase
          .from("prestations_commandes")
          .select(PRESTATION_PLANNING_SELECT)
          .in("statut", ["en_attente", "confirme", "en_cours", "realise"])
          .not("date_souhaitee", "is", null),
      ),
      chargerToutesLesLignes<Conge>(() =>
        supabase
          .from("conges")
          .select("id, admin_user_id, titre, date_debut, date_fin, notes"),
      ),
    ]);

    return {
      prestations: [...prestations].sort((a, b) =>
        String(a.date_souhaitee ?? "").localeCompare(
          String(b.date_souhaitee ?? ""),
        ),
      ),
      conges: [...conges].sort((a, b) =>
        String(a.date_debut ?? "").localeCompare(String(b.date_debut ?? "")),
      ),
    };
  } catch (error) {
    console.error("getPlanningData", error);
    return { prestations: [], conges: [] };
  }
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

  try {
    const [prestationsBrutes, taches] = await Promise.all([
      chargerToutesLesLignes<PlanningPrestation>(() =>
        supabase
          .from("prestations_commandes")
          .select(PRESTATION_PLANNING_SELECT)
          .in("statut", ["en_attente", "confirme", "en_cours", "realise"])
          .not("date_souhaitee", "is", null)
          .gte("date_souhaitee", weekStartKey)
          .lte("date_souhaitee", weekEndKey),
      ),
      chargerToutesLesLignes<TacheAdmin>(() =>
        supabase
          .from("taches_admin")
          .select("id, admin_user_id, titre, date, notes, created_at")
          .gte("date", weekStartKey)
          .lte("date", weekEndKey),
      ),
    ]);

    const prestations = prestationsBrutes
      .filter((prestation) => {
        const key = dateStringToKey(prestation.date_souhaitee);
        return key >= weekStartKey && key <= weekEndKey;
      })
      .sort((a, b) =>
        String(a.date_souhaitee ?? "").localeCompare(
          String(b.date_souhaitee ?? ""),
        ),
      );

    const tachesTriees = [...taches].sort((a, b) => {
      const byDate = String(a.date ?? "").localeCompare(String(b.date ?? ""));
      if (byDate !== 0) {
        return byDate;
      }
      return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    });

    return {
      weekStartKey,
      weekEndKey,
      prestations,
      taches: tachesTriees,
    };
  } catch (error) {
    console.error("getMobilePlanningWeekData", error);
    return {
      weekStartKey,
      weekEndKey,
      prestations: [],
      taches: [],
    };
  }
}
