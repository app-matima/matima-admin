import type { StatutPrestation } from "@/types";

export interface MjpmProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
}

export interface ClientListItem {
  organisationId: string;
  mjpm: MjpmProfile | null;
  created_at: string;
  protegesActifs: number;
}

export interface ProtegesParStatut {
  actif: number;
  archive: number;
  decede: number;
}

export interface ClientPrestationItem {
  id: string;
  description: string;
  date_souhaitee: string;
  statut: StatutPrestation;
  majeurs:
    | { nom: string; prenom: string }
    | { nom: string; prenom: string }[]
    | null;
}

export interface ClientDetail {
  organisationId: string;
  mjpm: MjpmProfile | null;
  created_at: string;
  protegesParStatut: ProtegesParStatut;
  dernieresPrestations: ClientPrestationItem[];
}

export const statutsMajeurModal: (keyof ProtegesParStatut)[] = [
  "actif",
  "archive",
  "decede",
];
