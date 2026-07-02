import type { StatutPrestation } from "@/types";
import type { Plan } from "@/lib/clients/plans";

export type { Plan };

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
  plan: Plan | null;
  plan_id: string | null;
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
  plan: Plan | null;
  plan_id: string | null;
  dossiersActifs: number;
  protegesParStatut: ProtegesParStatut;
  dernieresPrestations: ClientPrestationItem[];
}

export const statutsMajeurModal: (keyof ProtegesParStatut)[] = [
  "actif",
  "archive",
  "decede",
];
