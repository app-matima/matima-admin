import type { StatutPrestation } from "@/types";
import type { BadgeVariant } from "@/components/shared/badge";

export type FiltrePrestation =
  | "toutes"
  | "en_attente"
  | "confirme"
  | "en_cours"
  | "realise"
  | "annule";

export const filtresPrestation: { id: FiltrePrestation; label: string }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "en_attente", label: "En attente" },
  { id: "confirme", label: "Confirmées" },
  { id: "en_cours", label: "En cours" },
  { id: "realise", label: "Réalisées" },
  { id: "annule", label: "Annulées" },
];

export function filtrerPrestations<T extends { statut: StatutPrestation }>(
  prestations: T[],
  filtre: FiltrePrestation,
): T[] {
  if (filtre === "toutes") {
    return prestations;
  }

  return prestations.filter((prestation) => prestation.statut === filtre);
}

export function formatHeureSouhaitee(heure?: string | null): string {
  if (!heure?.trim()) {
    return "—";
  }

  const partie = heure.trim().split("T").pop() ?? heure.trim();
  return partie.slice(0, 5);
}

export function getNomMajeur(
  majeur:
    | { nom: string; prenom: string }
    | { nom: string; prenom: string }[]
    | null
    | undefined,
): string {
  if (!majeur) {
    return "—";
  }

  const donnees = Array.isArray(majeur) ? majeur[0] : majeur;
  if (!donnees?.nom) {
    return "—";
  }

  return `${donnees.nom} ${donnees.prenom ?? ""}`.trim();
}

export function getNomOrganisation(
  organisation:
    | { nom: string }
    | { nom: string }[]
    | null
    | undefined,
): string {
  if (!organisation) {
    return "—";
  }

  const donnees = Array.isArray(organisation) ? organisation[0] : organisation;
  return donnees?.nom ?? "—";
}

export function getStatutPrestationLabel(statut: StatutPrestation): string {
  switch (statut) {
    case "en_attente":
      return "En attente";
    case "confirme":
      return "Confirmée";
    case "en_cours":
      return "En cours";
    case "realise":
      return "Réalisée";
    case "annule":
      return "Annulée";
    default:
      return statut;
  }
}

export function getStatutPrestationBadgeVariant(
  statut: StatutPrestation,
): BadgeVariant {
  switch (statut) {
    case "en_attente":
      return "warning";
    case "confirme":
      return "info";
    case "en_cours":
      return "info";
    case "realise":
      return "success";
    case "annule":
      return "neutral";
    default:
      return "neutral";
  }
}

export function getPrestationsEnAttenteNonAssignees<
  T extends { statut: StatutPrestation; prestataire_id?: string | null },
>(prestations: T[]): T[] {
  return prestations.filter(
    (prestation) =>
      prestation.statut === "en_attente" && !prestation.prestataire_id,
  );
}

export function getPrestationsMesMissions<
  T extends {
    statut: StatutPrestation;
    prestataire_id?: string | null;
  },
>(prestations: T[], prestataireId: string): T[] {
  return prestations.filter(
    (prestation) =>
      prestation.prestataire_id === prestataireId &&
      (prestation.statut === "confirme" || prestation.statut === "en_cours"),
  );
}

export function getPrestationsHistorique<
  T extends {
    statut: StatutPrestation;
    prestataire_id?: string | null;
  },
>(prestations: T[], prestataireId: string): T[] {
  return prestations.filter(
    (prestation) =>
      prestation.prestataire_id === prestataireId &&
      (prestation.statut === "realise" || prestation.statut === "annule"),
  );
}
