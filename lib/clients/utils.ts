import type { ClientListItem, MjpmProfile } from "@/types/clients";

export function getMjpmNomComplet(mjpm: MjpmProfile | null): string {
  if (!mjpm) {
    return "—";
  }

  return `${mjpm.prenom} ${mjpm.nom}`.trim() || "—";
}

export function matchesMjpmSearch(
  client: ClientListItem,
  terme: string,
): boolean {
  if (!client.mjpm) {
    return false;
  }

  const nomComplet = getMjpmNomComplet(client.mjpm).toLowerCase();
  const nom = client.mjpm.nom.toLowerCase();
  const prenom = client.mjpm.prenom.toLowerCase();

  return (
    nomComplet.includes(terme) ||
    nom.includes(terme) ||
    prenom.includes(terme)
  );
}

export function getStatutMajeurLabel(
  statut: "actif" | "archive" | "decede",
): string {
  switch (statut) {
    case "actif":
      return "Actifs";
    case "archive":
      return "Archivés";
    case "decede":
      return "Décédés";
    default:
      return statut;
  }
}

export function getStatutMajeurBadgeVariant(
  statut: "actif" | "archive" | "decede",
): "success" | "neutral" | "danger" {
  switch (statut) {
    case "actif":
      return "success";
    case "archive":
      return "neutral";
    case "decede":
      return "danger";
    default:
      return "neutral";
  }
}
