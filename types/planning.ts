import type { PrestationAvecRelations } from "@/types";

export interface Conge {
  id: string;
  admin_user_id: string;
  titre: string;
  date_debut: string;
  date_fin: string;
  notes: string | null;
}

export interface TacheAdmin {
  id: string;
  admin_user_id: string;
  titre: string;
  date: string;
  notes: string | null;
  created_at?: string;
}

export interface PlanningPrestation extends PrestationAvecRelations {
  date_acceptee: string | null;
  prestataire_id: string | null;
}

export type PlanningEventKind =
  | "prestation_confirmed"
  | "prestation_pending"
  | "conge"
  | "tache";

export interface PlanningEvent {
  id: string;
  kind: PlanningEventKind;
  dateKey: string;
  label: string;
  prestation?: PlanningPrestation;
  conge?: Conge;
  tache?: TacheAdmin;
}

export interface CalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}
