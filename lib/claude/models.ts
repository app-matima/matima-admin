export const CLAUDE_MODEL_HAIKU = "claude-haiku-4-5-20251001";

/** Défaut appel A — identification du protégé. */
export const CLASSIFICATION_MODELE_PROTEGE_DEFAUT = CLAUDE_MODEL_HAIKU;

/** Défaut appel B — choix du dossier. */
export const CLASSIFICATION_MODELE_DOSSIER_DEFAUT = "claude-sonnet-5";

export function modeleClassificationProtege(): string {
  return (
    process.env.CLASSIFICATION_MODELE_PROTEGE?.trim() ||
    CLASSIFICATION_MODELE_PROTEGE_DEFAUT
  );
}

export function modeleClassificationDossier(): string {
  return (
    process.env.CLASSIFICATION_MODELE_DOSSIER?.trim() ||
    CLASSIFICATION_MODELE_DOSSIER_DEFAUT
  );
}
