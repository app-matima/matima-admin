export interface CategorieDocument {
  id: string;
  organisation_id: string;
  nom: string;
  couleur: string;
  created_at?: string;
}

export interface GedDossier {
  id: string;
  organisation_id: string;
  majeur_id: string;
  parent_id?: string | null;
  nom: string;
  cree_par_ia?: boolean;
  created_at?: string;
}

export type StatutClassementDocument =
  | "en_attente_classement"
  | "classe"
  | "echec_classement";

export interface Document {
  id: string;
  organisation_id: string;
  majeur_id?: string | null;
  categorie_id?: string | null;
  ged_dossier_id?: string | null;
  storage_path: string;
  type_document: string;
  nom_original: string;
  nom_fichier?: string;
  taille_bytes: number;
  date_document?: string | null;
  proposition_categorie_id?: string | null;
  proposition_majeur_id?: string | null;
  proposition_ged_dossier_id?: string | null;
  proposition_nouveau_chemin_dossier?: string[] | null;
  proposition_suggestion_dossier_existant?: {
    id: string;
    nom: string;
  } | null;
  proposition_nom?: string | null;
  statut_classement?: StatutClassementDocument | null;
  erreur_classement?: string | null;
  created_at?: string;
}

export interface PropositionDocumentIA {
  gedDossierId: string | null;
  majeurId: string | null;
  nomFichier: string | null;
  nouveauCheminDossier: string[] | null;
}

export interface DocumentNonClasse extends Document {
  proposition_majeur_id?: string | null;
  proposition_ged_dossier_id?: string | null;
  proposition_nouveau_chemin_dossier?: string[] | null;
  proposition_suggestion_dossier_existant?: {
    id: string;
    nom: string;
  } | null;
  proposition_nom?: string | null;
  statut_classement?: StatutClassementDocument | null;
  erreur_classement?: string | null;
}

export interface MajeurActif {
  id: string;
  nom: string;
  prenom: string;
}
