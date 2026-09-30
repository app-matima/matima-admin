import type { MjpmProfile } from "@/types/clients";
import type {
  DocumentNonClasse,
  GedDossier,
  MajeurActif,
} from "@/types/documents";

export interface ScanGedOrganisation {
  organisationId: string;
  cabinetNom: string;
  mjpm: MjpmProfile | null;
}

export interface ScanGedAdminInfo {
  id: string;
  nom: string;
  prenom: string;
}

export interface ScanGedOrganisationContext {
  dossiers: GedDossier[];
  majeurs: MajeurActif[];
  documents: DocumentNonClasse[];
  /** Admin connecté (pour filtrage côté client / libellés). */
  adminCourantId: string | null;
  /** Admins ayant scanné au moins un document de la liste. */
  scanAdmins: ScanGedAdminInfo[];
}
