/** Empreintes SHA-256 Scan GED — validation et helpers purs (client + serveur). */

export const REGEX_CONTENU_SHA256 = /^[0-9a-f]{64}$/;
export const MAX_HASH_PAR_APPEL_VERIFICATION = 500;
export const TAILLE_LOT_BACKFILL_EMPREINTES = 50;
export const CONCURRENCE_TELECHARGEMENT_BACKFILL = 5;
/** Budget temps interne backfill (ms) — laisser une marge sous maxDuration. */
export const BUDGET_MS_BACKFILL_EMPREINTES = 200_000;

export function estContenuSha256Valide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && REGEX_CONTENU_SHA256.test(valeur);
}

export function normaliserContenuSha256(
  valeur: unknown,
): string | null {
  if (typeof valeur !== "string") {
    return null;
  }
  const normalise = valeur.trim().toLowerCase();
  return estContenuSha256Valide(normalise) ? normalise : null;
}

/**
 * Découpe une liste en paquets (ex. vérification API ≤ 500 hash).
 */
export function decouperEnPaquets<T>(items: T[], taille: number): T[][] {
  const limite = Math.max(1, Math.floor(taille));
  const paquets: T[][] = [];
  for (let i = 0; i < items.length; i += limite) {
    paquets.push(items.slice(i, i + limite));
  }
  return paquets;
}

export interface FichierAvecEmpreinte {
  index: number;
  nom: string;
  contenuSha256: string | null;
}

/**
 * Doublons internes au lot : pour chaque hash, ne garde que le premier index.
 * Les fichiers sans hash ne sont jamais considérés comme doublons internes.
 */
export function detecterDoublonsInternesLot(
  fichiers: FichierAvecEmpreinte[],
): {
  indexesAGarder: number[];
  doublonsInternes: {
    index: number;
    nom: string;
    contenuSha256: string;
    indexConserve: number;
    nomConserve: string;
  }[];
} {
  const vu = new Map<string, { index: number; nom: string }>();
  const indexesAGarder: number[] = [];
  const doublonsInternes: {
    index: number;
    nom: string;
    contenuSha256: string;
    indexConserve: number;
    nomConserve: string;
  }[] = [];

  for (const fichier of fichiers) {
    if (!fichier.contenuSha256) {
      indexesAGarder.push(fichier.index);
      continue;
    }
    const existant = vu.get(fichier.contenuSha256);
    if (!existant) {
      vu.set(fichier.contenuSha256, {
        index: fichier.index,
        nom: fichier.nom,
      });
      indexesAGarder.push(fichier.index);
      continue;
    }
    doublonsInternes.push({
      index: fichier.index,
      nom: fichier.nom,
      contenuSha256: fichier.contenuSha256,
      indexConserve: existant.index,
      nomConserve: existant.nom,
    });
  }

  return { indexesAGarder, doublonsInternes };
}

export type EmplacementDoublonScanGed =
  | { type: "file"; libelle: string }
  | {
      type: "ged";
      libelle: string;
      majeurId: string;
      majeurNom: string;
      dossierNom: string | null;
    };

export interface DoublonConnuScanGed {
  contenuSha256: string;
  documentId: string;
  nomOriginal: string;
  createdAt: string | null;
  emplacement: EmplacementDoublonScanGed;
}

/**
 * Décide quels fichiers envoyer selon le choix utilisateur.
 * - nouveaux : exclut hash déjà connus + doublons internes (garde le 1er)
 * - tous : exclut seulement les doublons internes (garde le 1er de chaque hash)
 * - annuler : liste vide
 */
export function selectionnerFichiersApresConfirmation(params: {
  choix: "nouveaux" | "tous" | "annuler";
  fichiers: FichierAvecEmpreinte[];
  hashesConnus: Set<string>;
}): number[] {
  if (params.choix === "annuler") {
    return [];
  }

  const { indexesAGarder } = detecterDoublonsInternesLot(params.fichiers);

  if (params.choix === "tous") {
    return indexesAGarder;
  }

  return indexesAGarder.filter((index) => {
    const fichier = params.fichiers.find((item) => item.index === index);
    if (!fichier) {
      return false;
    }
    if (!fichier.contenuSha256) {
      return true;
    }
    return !params.hashesConnus.has(fichier.contenuSha256);
  });
}

export function octetsVersSha256Hex(octets: ArrayBuffer): string {
  const bytes = new Uint8Array(octets);
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}
