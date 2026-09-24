/**
 * Similarité de noms de dossiers GED (plus large que singulier/pluriel strict).
 * Seuils ajustables pour affinage après retours terrain.
 */

import { nomsDossiersQuasiIdentiques } from "@/lib/documents/ged-dossier-utils";

/** Score minimum (0–1) pour proposer un dossier existant comme suggestion. */
export const SEUIL_SIMILARITE_DOSSIER = 0.62;

/** Bonus si l'un des noms normalisés contient l'autre (mots ≥ 4 car.). */
export const BONUS_INCLUSION_SOUS_CHAINE = 0.15;

export interface SuggestionDossierExistant {
  id: string;
  nom: string;
}

export interface DossierPourSimilarite {
  id: string;
  nom: string;
}

function normaliserPourSimilarite(nom: string): string {
  let base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Singulier / pluriel simple (aligné sur nomsDossiersQuasiIdentiques)
  if (base.length > 3 && base.endsWith("s")) {
    base = base.slice(0, -1);
  }

  return base;
}

function tokeniser(nomNormalise: string): string[] {
  return nomNormalise.split(" ").filter((token) => token.length > 0);
}

/** Distance de Levenshtein classique. */
export function distanceLevenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  const courante = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    courante[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(
        (precedente[j] ?? 0) + 1,
        (courante[j - 1] ?? 0) + 1,
        (precedente[j - 1] ?? 0) + cout
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      precedente[j] = courante[j] ?? 0;
    }
  }

  return precedente[b.length] ?? 0;
}

/** Similarité basée sur Levenshtein : 1 = identique, 0 = totalement différent. */
export function similariteLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }
  return 1 - distanceLevenshtein(a, b) / maxLen;
}

/**
 * Chevauchement de mots (indice de Jaccard sur les tokens).
 * 1 = mêmes mots, 0 = aucun mot en commun.
 */
export function similariteChevauchementMots(a: string, b: string): number {
  const tokensA = new Set(tokeniser(a));
  const tokensB = new Set(tokeniser(b));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Score combiné entre deux noms de dossiers (après normalisation).
 */
export function scoreSimilariteNomsDossiers(
  nomA: string,
  nomB: string
): number {
  if (nomsDossiersQuasiIdentiques(nomA, nomB)) {
    return 1;
  }

  const a = normaliserPourSimilarite(nomA);
  const b = normaliserPourSimilarite(nomB);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  let score = Math.max(
    similariteLevenshtein(a, b),
    similariteChevauchementMots(a, b)
  );

  const minLen = Math.min(a.length, b.length);
  if (
    minLen >= 4 &&
    (a.includes(b) || b.includes(a))
  ) {
    score = Math.min(1, score + BONUS_INCLUSION_SOUS_CHAINE);
  }

  return score;
}

/**
 * Parmi les dossiers du protégé, trouve le plus proche du premier segment
 * d'un nouveau chemin proposé — sans forcer son utilisation.
 */
export function trouverSuggestionDossierExistant(
  premierSegment: string,
  dossiers: readonly DossierPourSimilarite[],
  seuil = SEUIL_SIMILARITE_DOSSIER
): SuggestionDossierExistant | null {
  const segment = premierSegment.trim();
  if (!segment || dossiers.length === 0) {
    return null;
  }

  let meilleur: { dossier: DossierPourSimilarite; score: number } | null = null;

  for (const dossier of dossiers) {
    const score = scoreSimilariteNomsDossiers(segment, dossier.nom);
    if (score < seuil) {
      continue;
    }
    if (!meilleur || score > meilleur.score) {
      meilleur = { dossier, score };
    }
  }

  if (!meilleur) {
    return null;
  }

  return {
    id: meilleur.dossier.id,
    nom: meilleur.dossier.nom,
  };
}
