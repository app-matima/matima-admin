import type { BadgeVariant } from "@/components/shared/badge";
import { getMjpmNomComplet } from "@/lib/clients/utils";
import type { CleProtege, OrganisationClesGroupe, StatutCle } from "@/types/cles";

export type FiltreCle = "tous" | "a_recuperer" | "recupere";

export const filtresCle: { id: FiltreCle; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "a_recuperer", label: "À récupérer" },
  { id: "recupere", label: "Récupéré" },
];

export const statutsCle: StatutCle[] = [
  "non_possede",
  "a_recuperer",
  "recupere",
  "rendu",
];

export function getStatutCleLabel(statut: StatutCle): string {
  switch (statut) {
    case "non_possede":
      return "Non possédé";
    case "a_recuperer":
      return "À récupérer";
    case "recupere":
      return "Récupéré";
    case "rendu":
      return "Rendu";
    default:
      return statut;
  }
}

export function getStatutCleBadgeVariant(statut: StatutCle): BadgeVariant {
  switch (statut) {
    case "non_possede":
      return "neutral";
    case "a_recuperer":
      return "warning";
    case "recupere":
      return "success";
    case "rendu":
      return "info";
    default:
      return "neutral";
  }
}

export function getNomProtege(protege: Pick<CleProtege, "nom" | "prenom">): string {
  return `${protege.nom} ${protege.prenom}`.trim() || "—";
}

export function formatProtegeCount(count: number): string {
  return count <= 1 ? `${count} protégé` : `${count} protégés`;
}

export function filtrerGroupesParRecherche(
  groupes: OrganisationClesGroupe[],
  recherche: string,
): OrganisationClesGroupe[] {
  const terme = recherche.trim().toLowerCase();
  if (!terme) {
    return groupes;
  }

  return groupes
    .map((groupe) => {
      const mjpmNom = getMjpmNomComplet(groupe.mjpm).toLowerCase();
      if (mjpmNom.includes(terme)) {
        return groupe;
      }

      const proteges = groupe.proteges.filter((protege) =>
        getNomProtege(protege).toLowerCase().includes(terme),
      );

      return { ...groupe, proteges };
    })
    .filter((groupe) => groupe.proteges.length > 0);
}

export function filtrerGroupesCles(
  groupes: OrganisationClesGroupe[],
  filtre: FiltreCle,
): OrganisationClesGroupe[] {
  if (filtre === "tous") {
    return groupes;
  }

  return groupes
    .map((groupe) => ({
      ...groupe,
      proteges: groupe.proteges.filter((protege) => protege.statut === filtre),
    }))
    .filter((groupe) => groupe.proteges.length > 0);
}
