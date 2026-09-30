/** Tolérance quasi nulle — imprécision flottante uniquement, pas d'écart financier accepté. */
export const TOLERANCE_RESTE_A_EXPLIQUER = 0.001;

export function formaterMontantFr(montant: number): string {
  return montant.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formaterDateFr(isoDate: string): string {
  const [annee, mois, jour] = isoDate.slice(0, 10).split("-");
  if (!annee || !mois || !jour) {
    return isoDate;
  }
  return `${jour}/${mois}/${annee}`;
}

export function calculerResteAExpliquer(
  ecartContinuiteInitial: number,
  sommeTransactionsManuelles: number
): number {
  return (
    Math.round((ecartContinuiteInitial - sommeTransactionsManuelles) * 1000) /
    1000
  );
}

export function resteAExpliquerEstResolu(reste: number): boolean {
  return Math.abs(reste) <= TOLERANCE_RESTE_A_EXPLIQUER;
}

export function construireMessageDynamiqueTrou(params: {
  resteAExpliquer: number;
  trouDebut: string;
  trouFin: string;
}): string {
  return `Reste à expliquer : ${formaterMontantFr(
    Math.abs(params.resteAExpliquer)
  )} € — période du ${formaterDateFr(params.trouDebut)} au ${formaterDateFr(
    params.trouFin
  )} non couverte par un relevé`;
}

export const CHAMPS_META_VERIFICATION_VIDES = {
  verification_compte_id: null,
  verification_trou_debut: null,
  verification_trou_fin: null,
  verification_ecart_continuite: null,
} as const;
