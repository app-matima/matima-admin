import { normaliserTexteMatching } from "@/lib/documents/import-drive-matching";

/**
 * Noms de dossiers GED considérés comme destinés aux relevés bancaires
 * (après normalisation : minuscules, sans accents, espaces normalisés).
 * Volontairement strict : pas « banque » / « comptes » pour éviter les
 * faux positifs (ex. sous-dossier « Virements » sous « Banques »).
 */
const NOMS_EXACTS = new Set([
  "releve",
  "releves",
  "releve bancaire",
  "releves bancaires",
  "releve de compte",
  "releves de comptes",
]);

/** Alias pour correspondance partielle (ex. « Relevés 2024 », « Relevé de compte CA »). */
const NOMS_PARTIELS = [
  "releve bancaire",
  "releves bancaires",
  "releve de compte",
  "releves de comptes",
  "releve",
  "releves",
] as const;

/**
 * Indique si le nom d'un dossier GED évoque un dossier de relevés bancaires.
 * Ne regarde que le nom fourni (pas les ancêtres).
 */
export function estDossierBancaire(nomDossier: string): boolean {
  const normalise = normaliserTexteMatching(nomDossier);
  if (!normalise) {
    return false;
  }

  if (NOMS_EXACTS.has(normalise)) {
    return true;
  }

  for (const alias of NOMS_PARTIELS) {
    if (
      normalise.startsWith(`${alias} `) ||
      normalise.endsWith(` ${alias}`) ||
      normalise.includes(` ${alias} `)
    ) {
      return true;
    }
  }

  return false;
}

interface DossierPourFiltrageBancaire {
  id: string;
  nom: string;
  /** Conservé pour compatibilité d'appel — non utilisé (pas de remontée ancêtres). */
  parent_id?: string | null;
}

/**
 * Retourne les ids de dossiers dont le nom immédiat correspond à un dossier
 * de relevés (sans inclure les descendants d'un ancêtre « Banque », etc.).
 */
export function collecterIdsDossiersBancaires(
  dossiers: DossierPourFiltrageBancaire[]
): Set<string> {
  const ids = new Set<string>();

  for (const dossier of dossiers) {
    if (estDossierBancaire(dossier.nom)) {
      ids.add(dossier.id);
    }
  }

  return ids;
}
