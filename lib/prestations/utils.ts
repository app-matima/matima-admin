import type { StatutPrestation } from "@/types";
import type { BadgeVariant } from "@/components/shared/badge";

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
