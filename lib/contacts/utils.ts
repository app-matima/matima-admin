import type { ContactInterne } from "@/types/contacts";

export function getContactNomComplet(contact: ContactInterne): string {
  const parts = [contact.prenom, contact.nom].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : contact.nom;
}

export function formatContactValeur(
  valeur: string | null | undefined,
): string {
  const trimmed = valeur?.trim();
  return trimmed ? trimmed : "—";
}
