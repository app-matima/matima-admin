export interface CategorieDocument {
  id: string;
  organisation_id: string;
  nom: string;
  couleur: string;
  created_at?: string;
}

export interface Document {
  id: string;
  organisation_id: string;
  majeur_id?: string | null;
  categorie_id?: string | null;
  storage_path: string;
  type_document: string;
  nom_original: string;
  nom_fichier?: string;
  taille_bytes: number;
  date_document?: string | null;
  proposition_categorie_id?: string | null;
  proposition_majeur_id?: string | null;
  proposition_nom?: string | null;
  created_at?: string;
}

export interface PropositionDocumentIA {
  categorieId: string | null;
  majeurId: string | null;
  nomFichier: string | null;
}

export interface DocumentNonClasse extends Document {
  proposition_categorie_id?: string | null;
  proposition_majeur_id?: string | null;
  proposition_nom?: string | null;
}

export interface MajeurActif {
  id: string;
  nom: string;
  prenom: string;
}
