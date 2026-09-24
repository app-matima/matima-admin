/** Valeur sentinelle du sélecteur de dossier pour un nouveau chemin IA non encore créé. */
export const NOUVEAU_DOSSIER_SELECTION = "__nouveau_dossier__";

/** Chemin saisi manuellement par le MJPM, à créer à la validation. */
export const NOUVEAU_DOSSIER_MANUEL = "__nouveau_dossier_manuel__";

/** Empêche de coller une syntaxe de chemin dans un nom de dossier. */
export function nettoyerNomSegmentDossier(valeur: string): string {
  return valeur.replace(/[/\\>]/g, "");
}

export function libelleNouveauCheminDossierPropose(segments: string[]): string {
  const chemin = segments.map((segment) => segment.trim()).filter(Boolean).join(" / ");
  return chemin ? `Nouveau chemin : ${chemin}` : "Nouveau chemin de dossiers";
}
