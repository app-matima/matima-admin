import type { GedDossier } from "@/types/documents";

export function formatCheminDossier(
  dossierId: string,
  dossiers: GedDossier[]
): string {
  const parId = new Map(dossiers.map((dossier) => [dossier.id, dossier]));
  const segments: string[] = [];

  let courant = parId.get(dossierId);
  while (courant) {
    segments.unshift(courant.nom);
    courant = courant.parent_id
      ? parId.get(courant.parent_id)
      : undefined;
  }

  return segments.join(" / ");
}

const SEPARATEUR_CHEMIN_GED = " > ";

export interface SegmentCheminProposition {
  libelle: string;
  estNouveau: boolean;
}

function normaliserNomDossierPourComparaison(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Normalisation pour anti-doublons GED : casse, accents, espaces,
 * et « s » final (singulier / pluriel simple), sans toucher aux mots trop courts.
 */
export function normaliserNomDossierPourQuasiIdentite(nom: string): string {
  const base = normaliserNomDossierPourComparaison(nom);
  if (base.length > 3 && base.endsWith("s")) {
    return base.slice(0, -1);
  }
  return base;
}

/** True si deux noms de dossiers sont quasi-identiques (ex. Attestation / Attestations). */
export function nomsDossiersQuasiIdentiques(a: string, b: string): boolean {
  return (
    normaliserNomDossierPourQuasiIdentite(a) ===
    normaliserNomDossierPourQuasiIdentite(b)
  );
}

/** Segments du chemin depuis la racine jusqu'au dossier cible. */
export function extraireSegmentsCheminDossier(
  dossierId: string,
  dossiers: GedDossier[]
): string[] {
  const parId = new Map(dossiers.map((dossier) => [dossier.id, dossier]));
  const segments: string[] = [];

  let courant = parId.get(dossierId);
  while (courant) {
    segments.unshift(courant.nom);
    courant = courant.parent_id
      ? parId.get(courant.parent_id)
      : undefined;
  }

  return segments;
}

/** Chemin existant : tous les segments sont déjà présents dans l'arborescence. */
export function analyserSegmentsCheminExistant(
  dossierId: string,
  dossiers: GedDossier[]
): SegmentCheminProposition[] {
  return extraireSegmentsCheminDossier(dossierId, dossiers).map((libelle) => ({
    libelle,
    estNouveau: false,
  }));
}

/**
 * Compare un chemin proposé à l'arborescence du protégé :
 * segments déjà présents vs segments qui seront créés à la validation.
 */
export function analyserSegmentsNouveauChemin(
  segmentsProposes: string[],
  dossiers: GedDossier[]
): SegmentCheminProposition[] {
  const segments = segmentsProposes
    .map((segment) => segment.trim())
    .filter(Boolean);

  let parentId: string | null = null;
  let brancheInexistante = false;
  const resultat: SegmentCheminProposition[] = [];

  for (const libelle of segments) {
    if (brancheInexistante) {
      resultat.push({ libelle, estNouveau: true });
      continue;
    }

    const enfants = dossiers.filter((dossier) =>
      parentId === null
        ? dossier.parent_id == null
        : dossier.parent_id === parentId
    );

    const correspondance = enfants.find(
      (dossier) =>
        normaliserNomDossierPourComparaison(dossier.nom) ===
        normaliserNomDossierPourComparaison(libelle)
    );

    if (correspondance) {
      parentId = correspondance.id;
      resultat.push({ libelle, estNouveau: false });
      continue;
    }

    brancheInexistante = true;
    resultat.push({ libelle, estNouveau: true });
  }

  return resultat;
}

/** Chemin dossier pour affichage type fil d'Ariane (Identité > Sous-dossier). */
export function formatCheminDossierBreadcrumb(
  dossierId: string,
  dossiers: GedDossier[]
): string {
  return formatCheminDossier(dossierId, dossiers).replace(/ \/ /g, SEPARATEUR_CHEMIN_GED);
}

/** Chemin proposé par l'IA (segments depuis la racine) en fil d'Ariane. */
export function formatSegmentsCheminBreadcrumb(segments: string[]): string {
  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(SEPARATEUR_CHEMIN_GED);
}

export function getDestinationDossierId(
  cheminDossiers: string[],
  indexColonne: number
): string | null {
  if (indexColonne <= 0) {
    return null;
  }

  return cheminDossiers[indexColonne - 1] ?? null;
}
