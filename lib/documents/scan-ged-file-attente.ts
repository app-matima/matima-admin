export const STATUT_CLASSEMENT_EN_ATTENTE = "en_attente_classement" as const;
export const STATUT_CLASSEMENT_CLASSE = "classe" as const;
export const STATUT_CLASSEMENT_ECHEC = "echec_classement" as const;

export type StatutClassementDocument =
  | typeof STATUT_CLASSEMENT_EN_ATTENTE
  | typeof STATUT_CLASSEMENT_CLASSE
  | typeof STATUT_CLASSEMENT_ECHEC;

export const TAILLE_LOT_CLASSEMENT_DEFAUT = 5;

export interface DetailTraitementLot {
  documentId: string;
  nom: string;
  statut: StatutClassementDocument;
  erreur: string | null;
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

export function patchStatutApresClassement(params: {
  succes: boolean;
  messageErreur?: string | null;
}): {
  statut_classement: StatutClassementDocument;
  erreur_classement: string | null;
} {
  if (params.succes) {
    return {
      statut_classement: STATUT_CLASSEMENT_CLASSE,
      erreur_classement: null,
    };
  }

  const message =
    typeof params.messageErreur === "string" && params.messageErreur.trim()
      ? params.messageErreur.trim()
      : "Erreur de classement inconnue.";

  return {
    statut_classement: STATUT_CLASSEMENT_ECHEC,
    erreur_classement: message,
  };
}

/**
 * Traite un paquet de documents indépendamment : l'échec d'un ne bloque pas les suivants.
 */
export async function traiterPaquetDocumentsIndependamment<TDocument extends { id: string; nom: string }>(
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
