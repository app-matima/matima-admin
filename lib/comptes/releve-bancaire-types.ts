export interface ResultatImportReleve {
  ignore: boolean;
  raisonIgnore?: string;
  transactionsImportees: number;
  transactionsIgnoreesDoublon: number;
  lignesRejetees: number;
  coherenceValidee: boolean;
  qualiteLisible: boolean;
  zonesIncertaines: string[];
  necessiteVerification: boolean;
  ecartSolde: number | null;
  messageVerification: string | null;
  banque?: string | null;
  numeroCompte?: string | null;
  /** Compte bancaire résolu / créé lors de l'import (pour passe continuité lot). */
  compteId?: string;
}

/** Année ciblée pour le traitement rétroactif des relevés (année civile en cours). */
export function getAnneeRelevesCible(): number {
  return new Date().getFullYear();
}

export interface DocumentReleveATraiter {
  id: string;
  nomOriginal: string;
  majeurId: string;
}

export type StatutTraitementReleve =
  | "importe"
  | "ignore_hors_annee"
  | "ignore_annee_illisible"
  | "erreur";

export interface ResultatTraitementReleveUnitaire {
  documentId: string;
  nomOriginal: string;
  statut: StatutTraitementReleve;
  annee: number | null;
  transactionsImportees: number;
  coherenceValidee: boolean;
  qualiteLisible: boolean;
  zonesIncertaines: string[];
  compteId?: string;
  erreur?: string;
}

export interface ResumeTraitementRelevesExistants {
  total: number;
  traites: number;
  ignoresHorsAnnee: number;
  ignoresAnneeIllisible: number;
  transactionsImportees: number;
  alertes: string[];
  erreurs: string[];
}

export interface ProgressionTraitementReleves {
  actuel: number;
  total: number;
  documentEnCours: string | null;
  resumePartiel: ResumeTraitementRelevesExistants;
}
