export type StatutPrestation =
  | "en_attente"
  | "confirme"
  | "en_cours"
  | "realise"
  | "annule";

export interface PrestationCommande {
  id: string;
  organisation_id: string;
  majeur_id: string;
  description: string;
  date_souhaitee: string;
  date_acceptee?: string | null;
  heure_souhaitee?: string | null;
  adresse_intervention?: string | null;
  instructions?: string | null;
  statut: StatutPrestation;
  prestataire_id?: string | null;
  attestation_url?: string | null;
  created_at?: string;
}

export interface Organisation {
  id: string;
  nom: string;
  created_at: string;
}

export interface PrestationAvecRelations extends PrestationCommande {
  majeurs:
    | { nom: string; prenom: string }
    | { nom: string; prenom: string }[]
    | null;
  organisations:
    | { nom: string }
    | { nom: string }[]
    | null;
}

export interface DashboardMetrics {
  prestationsEnAttente: number;
  prestationsEnCours: number;
  clientsActifs: number;
  protegesTotal: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  dernieresPrestations: PrestationAvecRelations[];
  nouveauxClients: Organisation[];
}
