/**
 * Trim + collapse des espaces pour libellés « dossiers à consulter ».
 * Aligné sur matima-app/lib/parametres/dossiers-a-consulter.ts
 */
export function normaliserLibelleDossier(nom: string): string {
  return nom.trim().replace(/\s+/g, " ");
}

export function dossierDejaPresent(liste: string[], nom: string): boolean {
  const normalise = normaliserLibelleDossier(nom).toLowerCase();
  return liste.some(
    (item) => normaliserLibelleDossier(item).toLowerCase() === normalise,
  );
}
