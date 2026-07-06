import type { MjpmProfile } from "@/types/clients";
import type {
  CategorieDocument,
  DocumentNonClasse,
  MajeurActif,
} from "@/types/documents";

export interface ScanGedOrganisation {
  organisationId: string;
  cabinetNom: string;
  mjpm: MjpmProfile | null;
}

export interface ScanGedOrganisationContext {
  categories: CategorieDocument[];
  majeurs: MajeurActif[];
  documents: DocumentNonClasse[];
}
