export interface Plan {
  id: string;
  nom: string;
  prix_par_dossier: number;
}

export const AUCUN_PLAN_LABEL = "Aucun plan";

export function formatPlanLabel(
  plan: Plan | null | undefined,
  planId?: string | null,
): string {
  if (!planId || !plan) {
    return AUCUN_PLAN_LABEL;
  }

  const prix =
    Number.isInteger(plan.prix_par_dossier)
      ? String(plan.prix_par_dossier)
      : String(plan.prix_par_dossier);
  return `${plan.nom} ${prix}€`;
}
