import type { BadgeVariant } from "@/components/shared/badge";
import type { CourrierAvecRelations, StatutCourrier, TypeEnvoi } from "@/types/courriers";

export type FiltreCourrier = "tous" | "en_attente" | "envoye";

export const filtresCourrier: { id: FiltreCourrier; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "en_attente", label: "En attente" },
  { id: "envoye", label: "Envoyés" },
];

export function filtrerCourriers(
  courriers: CourrierAvecRelations[],
  filtre: FiltreCourrier,
): CourrierAvecRelations[] {
  if (filtre === "tous") {
    return courriers;
  }

  return courriers.filter((courrier) => courrier.statut === filtre);
}

export function getTypeEnvoiLabel(type: TypeEnvoi): string {
  switch (type) {
    case "lettre_verte":
      return "Lettre verte";
    case "lettre_suivie":
      return "Lettre suivie";
    case "recommande_ar":
      return "Recommandé AR";
    default:
      return type;
  }
}

export function getTypeEnvoiBadgeVariant(type: TypeEnvoi): BadgeVariant {
  switch (type) {
    case "lettre_verte":
      return "success";
    case "lettre_suivie":
      return "info";
    case "recommande_ar":
      return "warning";
    default:
      return "neutral";
  }
}

export function getStatutCourrierLabel(statut: StatutCourrier): string {
  switch (statut) {
    case "en_attente":
      return "En attente";
    case "envoye":
      return "Envoyé";
    default:
      return statut;
  }
}

export function getStatutCourrierBadgeVariant(
  statut: StatutCourrier,
): BadgeVariant {
  switch (statut) {
    case "en_attente":
      return "warning";
    case "envoye":
      return "success";
    default:
      return "neutral";
  }
}

export function formatPrixFacture(prix: number | null | undefined): string {
  if (prix == null) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(prix);
}
