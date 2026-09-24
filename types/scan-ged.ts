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

export interface ScanGedOrganisationContext {
  dossiers: GedDossier[];
  majeurs: MajeurActif[];
  documents: DocumentNonClasse[];
}
