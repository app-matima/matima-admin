import type { MjpmProfile } from "@/types/clients";

export type StatutCle =
  | "non_possede"
  | "a_recuperer"
  | "recupere"
  | "rendu";

export interface CleProtege {
  cleId: string;
  majeurId: string;
  nom: string;
  prenom: string;
  statut: StatutCle;
  notes: string | null;
}

export interface OrganisationClesGroupe {
  organisationId: string;
  mjpm: MjpmProfile | null;
  proteges: CleProtege[];
}
