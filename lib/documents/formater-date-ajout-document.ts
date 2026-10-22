const FUSEAU_PARIS = "Europe/Paris";

/**
 * Formate documents.created_at pour l'aperçu GED.
 * Ex. « Ajouté le 15/01/2024 à 13:00 » (Europe/Paris).
 * Retourne null si absent ou invalide.
 */
export function formaterDateAjoutDocument(
  createdAt: string | null | undefined,
): string | null {
  if (typeof createdAt !== "string" || !createdAt.trim()) {
    return null;
  }

  const date = new Date(createdAt.trim());
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_PARIS,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const valeur = (type: Intl.DateTimeFormatPartTypes): string =>
    parties.find((partie) => partie.type === type)?.value ?? "";

  const jour = valeur("day");
  const mois = valeur("month");
  const annee = valeur("year");
  const heure = valeur("hour");
  const minute = valeur("minute");

  if (!jour || !mois || !annee || !heure || !minute) {
    return null;
  }

  return `Ajouté le ${jour}/${mois}/${annee} à ${heure}:${minute}`;
}
