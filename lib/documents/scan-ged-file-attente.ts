export const STATUT_CLASSEMENT_EN_ATTENTE = "en_attente_classement" as const;
export const STATUT_CLASSEMENT_EN_COURS = "classement_en_cours" as const;
export const STATUT_CLASSEMENT_CLASSE = "classe" as const;
export const STATUT_CLASSEMENT_ECHEC = "echec_classement" as const;

export type StatutClassementDocument =
  | typeof STATUT_CLASSEMENT_EN_ATTENTE
  | typeof STATUT_CLASSEMENT_EN_COURS
  | typeof STATUT_CLASSEMENT_CLASSE
  | typeof STATUT_CLASSEMENT_ECHEC;

export const TAILLE_LOT_CLASSEMENT_DEFAUT = 5;

/** Un classement_en_cours plus vieux que ça est considéré interrompu. */
export const EXPIRATION_CLASSEMENT_EN_COURS_MS = 10 * 60 * 1000;

export interface DetailTraitementLot {
  documentId: string;
  nom: string;
  statut: StatutClassementDocument;
  erreur: string | null;
}

export interface DocumentPourClaim {
  id: string;
  statut_classement: string | null | undefined;
  classement_started_at?: string | null;
  created_at?: string | null;
}

/**
 * Nombre restant après un lot : max(0, restantAvant − traités).
 * Les échecs comptent comme traités (quittent la file d'attente).
 */
export function calculerRestantApresLot(
  restantAvant: number,
  nombreTraites: number,
): number {
  return Math.max(0, restantAvant - nombreTraites);
}

export function estClassementEnCoursExpire(
  startedAt: string | null | undefined,
  maintenantMs: number = Date.now(),
  expirationMs: number = EXPIRATION_CLASSEMENT_EN_COURS_MS,
): boolean {
  if (!startedAt?.trim()) {
    return true;
  }
  const debut = Date.parse(startedAt);
  if (Number.isNaN(debut)) {
    return true;
  }
  return maintenantMs - debut >= expirationMs;
}

/**
 * Document encore à prendre en file (attente ou en_cours expiré).
 * Les échecs ne sont claimables que via documentIds (relance explicite).
 */
export function documentEligibleFileClassement(
  document: DocumentPourClaim,
  options?: {
    maintenantMs?: number;
    inclureEchecs?: boolean;
  },
): boolean {
  const statut = document.statut_classement;
  if (statut === STATUT_CLASSEMENT_EN_ATTENTE) {
    return true;
  }
  if (statut === STATUT_CLASSEMENT_EN_COURS) {
    return estClassementEnCoursExpire(
      document.classement_started_at,
      options?.maintenantMs,
    );
  }
  if (options?.inclureEchecs && statut === STATUT_CLASSEMENT_ECHEC) {
    return true;
  }
  return false;
}

/**
 * Simule un claim atomique (SKIP LOCKED) pour les tests de concurrence.
 * Mutates `file` : marque claimedBy sur les docs pris.
 */
export function simulerClaimAtomiqueSansDoublon(params: {
  file: { id: string; claimedBy: string | null }[];
  workerId: string;
  taille: number;
}): string[] {
  const claimés: string[] = [];
  for (const doc of params.file) {
    if (claimés.length >= params.taille) {
      break;
    }
    if (doc.claimedBy === null) {
      doc.claimedBy = params.workerId;
      claimés.push(doc.id);
    }
  }
  return claimés;
}

export function patchStatutApresClassement(params: {
  succes: boolean;
  messageErreur?: string | null;
}): {
  statut_classement: StatutClassementDocument;
  erreur_classement: string | null;
  classement_started_at: null;
} {
  if (params.succes) {
    return {
      statut_classement: STATUT_CLASSEMENT_CLASSE,
      erreur_classement: null,
      classement_started_at: null,
    };
  }

  const message =
    typeof params.messageErreur === "string" && params.messageErreur.trim()
      ? params.messageErreur.trim()
      : "Erreur de classement inconnue.";

  return {
    statut_classement: STATUT_CLASSEMENT_ECHEC,
    erreur_classement: message,
    classement_started_at: null,
  };
}

/**
 * Filet : exception inattendue → revenir en file (pas laisser classement_en_cours).
 */
export function patchStatutApresExceptionInattendue(): {
  statut_classement: typeof STATUT_CLASSEMENT_EN_ATTENTE;
  erreur_classement: null;
  classement_started_at: null;
} {
  return {
    statut_classement: STATUT_CLASSEMENT_EN_ATTENTE,
    erreur_classement: null,
    classement_started_at: null,
  };
}

/**
 * Boucle de lots avec possibilité d'arrêt (bouton Arrêter).
 */
export async function bouclerTraitementLotsClassement(params: {
  traiterLot: () => Promise<{ traite: number; restant: number }>;
  devraitArreter: () => boolean;
  onProgress?: (progress: { fait: number; total: number }) => void;
  totalInitial?: number;
}): Promise<{ fait: number; arrete: boolean }> {
  let fait = 0;
  let restant = Math.max(params.totalInitial ?? 1, 1);
  let gardeFou = 0;
  let arrete = false;
  const totalInitial = Math.max(params.totalInitial ?? 1, 1);

  params.onProgress?.({ fait: 0, total: totalInitial });

  while (restant > 0 && gardeFou < 10_000) {
    if (params.devraitArreter()) {
      arrete = true;
      break;
    }

    gardeFou += 1;
    const lot = await params.traiterLot();
    fait += lot.traite;
    restant = lot.restant;
    const totalAffiche = Math.max(fait + restant, totalInitial);
    params.onProgress?.({
      fait: Math.min(fait, totalAffiche),
      total: totalAffiche,
    });

    if (lot.traite === 0) {
      break;
    }
  }

  return { fait, arrete };
}

/**
 * Traite un paquet de documents indépendamment : l'échec d'un ne bloque pas les suivants.
 */
export async function traiterPaquetDocumentsIndependamment<
  TDocument extends { id: string; nom: string },
>(
  documents: TDocument[],
  classerUn: (document: TDocument) => Promise<void>,
): Promise<DetailTraitementLot[]> {
  const details: DetailTraitementLot[] = [];

  for (const document of documents) {
    try {
      await classerUn(document);
      details.push({
        documentId: document.id,
        nom: document.nom,
        statut: STATUT_CLASSEMENT_CLASSE,
        erreur: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de classement.";
      details.push({
        documentId: document.id,
        nom: document.nom,
        statut: STATUT_CLASSEMENT_ECHEC,
        erreur: message,
      });
    }
  }

  return details;
}
