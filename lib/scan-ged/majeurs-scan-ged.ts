import type { StatutMajeur } from "@/types/documents";

export const STATUTS_MAJEUR: readonly StatutMajeur[] = [
  "actif",
  "decede",
  "mainleve",
  "archive",
] as const;

/** Label singulier (badge Scan GED), aligné matima-app. */
export function getStatutMajeurLabelSingulier(statut: StatutMajeur): string {
  switch (statut) {
    case "actif":
      return "Actif";
    case "archive":
      return "Archivé";
    case "decede":
      return "Décédé";
    case "mainleve":
      return "Mainlevée";
    default:
      return statut;
  }
}

export function getStatutMajeurBadgeVariantScan(
  statut: StatutMajeur,
): "success" | "neutral" | "danger" | "warning" {
  switch (statut) {
    case "actif":
      return "success";
    case "archive":
      return "neutral";
    case "decede":
      return "danger";
    case "mainleve":
      return "warning";
    default:
      return "neutral";
  }
}

export function estStatutMajeur(valeur: string): valeur is StatutMajeur {
  return (STATUTS_MAJEUR as readonly string[]).includes(valeur);
}

/**
 * Actifs d'abord, puis les autres ; alpha (nom) dans chaque groupe.
 * Ne conserve que les majeurs de l'organisation fournie (filtre appelant).
 */
export function trierMajeursScanGed<
  T extends { nom: string; prenom: string; statut: StatutMajeur },
>(majeurs: T[]): T[] {
  const comparerAlpha = (a: T, b: T) => {
    const parNom = a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
    if (parNom !== 0) {
      return parNom;
    }
    return a.prenom.localeCompare(b.prenom, "fr", { sensitivity: "base" });
  };

  const actifs = majeurs.filter((m) => m.statut === "actif").sort(comparerAlpha);
  const autres = majeurs
    .filter((m) => m.statut !== "actif")
    .sort(comparerAlpha);

  return [...actifs, ...autres];
}

export function libelleOptionMajeurScanGed(majeur: {
  nom: string;
  prenom: string;
  statut: StatutMajeur;
}): string {
  const nomComplet = `${majeur.nom} ${majeur.prenom}`.trim();
  if (majeur.statut === "actif") {
    return nomComplet;
  }
  return `${nomComplet} — ${getStatutMajeurLabelSingulier(majeur.statut)}`;
}
