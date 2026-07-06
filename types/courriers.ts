export type StatutCourrier = "en_attente" | "envoye";

export type TypeEnvoi =
  | "lettre_verte"
  | "lettre_suivie"
  | "recommande_ar";

export interface Courrier {
  id: string;
  majeur_id: string;
  organisation_id: string;
  destinataire_nom: string;
  destinataire_adresse: string;
  type_envoi: TypeEnvoi;
  nombre_pages: number;
  prix_facture: number | null;
  statut: StatutCourrier;
  storage_path: string;
  created_at: string;
  envoye_at: string | null;
}

export interface CourrierAvecRelations extends Courrier {
  majeurs:
    | { nom: string; prenom: string }
    | { nom: string; prenom: string }[]
    | null;
  organisations: { nom: string } | { nom: string }[] | null;
}
