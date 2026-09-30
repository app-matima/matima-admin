/**
 * Matching fuzzy dossier Drive ↔ protégé (nom + prénom).
 * Partagé par le script CLI et l'import massif UI.
 */

export interface MajeurPourMatching {
  id: string;
  nom: string;
  prenom: string;
}

export type ResultatMatchingDossier =
  | { statut: "match"; majeur: MajeurPourMatching }
  | { statut: "aucun" }
  | { statut: "ambigu"; candidats: MajeurPourMatching[] };

/**
 * Retire les mentions parasites courantes dans les noms de dossiers Drive
 * (dates, DCD/DC, DESSAISI, née/EP, divorcée, PAS DE CRG, parenthèses…).
 */
export function nettoyerNomDossierPourMatching(nomDossier: string): string {
  let texte = nomDossier;

  // Mentions entre parenthèses / crochets : (Née X), (EP X), etc.
  texte = texte.replace(/\([^)]*\)/g, " ");
  texte = texte.replace(/\[[^\]]*\]/g, " ");

  // Suite de mots après un mot-clé (noms composés inclus)
  const suiteNom = String.raw`(?:[\s_-]+[\p{L}'-]+)+`;

  // Divorcée / Divorcé + nom associé
  texte = texte.replace(
    new RegExp(String.raw`\bdivorc[eé]e?s?\b${suiteNom}`, "giu"),
    " "
  );

  // Épouse / Époux / EP hors parenthèses (ex. "EP MARTIN")
  texte = texte.replace(
    new RegExp(
      String.raw`\b(?:ep\.?|epouse|époux|epoux|ex)\b${suiteNom}`,
      "giu"
    ),
    " "
  );

  // Née / Né hors parenthèses (évite le mot français "ne")
  texte = texte.replace(
    new RegExp(String.raw`\b(?:n[eé]e|nee|n[eé])\b${suiteNom}`, "giu"),
    " "
  );

  // Statuts / flags métier
  texte = texte.replace(/\b(?:dessaisi|dcd|dc)\b/gi, " ");
  texte = texte.replace(/[-–—]?\s*pas\s+de\s+crg\b/gi, " ");

  // Dates JJ MM AA / JJ/MM/AAAA / JJ-MM-AA…
  texte = texte.replace(/\b\d{1,2}[\s./_-]+\d{1,2}[\s./_-]+\d{2,4}\b/g, " ");

  return texte;
}

/** Minuscules, sans accents, ponctuation → espaces, espaces normalisés. */
export function normaliserTexteMatching(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(m\.?|mr\.?|mme\.?|mlle\.?|monsieur|madame|mademoiselle)\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokensMatching(valeur: string): string[] {
  return normaliserTexteMatching(valeur).split(" ").filter(Boolean);
}

export function labelMajeurPourMatching(majeur: MajeurPourMatching): string {
  return `${majeur.nom} ${majeur.prenom}`.trim();
}

/**
 * Match si, après nettoyage du dossier, tous les tokens du nom+prénom du
 * protégé sont présents (ordre libre). Exige au moins un token de nom et
 * un de prénom pour éviter les faux positifs trop larges.
 */
export function majeurCorrespondAuDossier(
  nomDossier: string,
  majeur: MajeurPourMatching
): boolean {
  const dossierNettoye = nettoyerNomDossierPourMatching(nomDossier);
  const tokensDossier = new Set(tokensMatching(dossierNettoye));

  if (tokensDossier.size === 0) {
    return false;
  }

  const tokensNom = tokensMatching(majeur.nom);
  const tokensPrenom = tokensMatching(majeur.prenom);

  if (tokensNom.length === 0 || tokensPrenom.length === 0) {
    return false;
  }

  const tokensMajeur = [...tokensNom, ...tokensPrenom];

  return tokensMajeur.every((token) => tokensDossier.has(token));
}

/** Résout le matching d'un dossier de 1er niveau contre la liste des protégés. */
export function matcherDossierVersMajeurs(
  nomDossier: string,
  majeurs: MajeurPourMatching[]
): ResultatMatchingDossier {
  const correspondants = majeurs.filter((majeur) =>
    majeurCorrespondAuDossier(nomDossier, majeur)
  );

  if (correspondants.length === 1) {
    return { statut: "match", majeur: correspondants[0] };
  }

  if (correspondants.length === 0) {
    return { statut: "aucun" };
  }

  return { statut: "ambigu", candidats: correspondants };
}
