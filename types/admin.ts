export type AdminRole = "admin" | "prestataire" | "administratif";

export interface AdminUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: AdminRole;
  actif: boolean;
}

export interface InviteAdminInput {
  prenom: string;
  nom: string;
  email: string;
  role: AdminRole;
}
