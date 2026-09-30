import { importerReleveBancaireDepuisDocument } from "@/lib/comptes/importer-releve-bancaire";
import { isPdf } from "@/lib/documents/document-utils";
import { estDossierBancaire } from "@/lib/documents/est-dossier-bancaire";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Même critère que matima-app (`dossierImmediatEstReleve`) :
 * le nom immédiat du dossier GED évoque un dossier de relevés.
 */
export async function dossierImmediatEstReleve(
  gedDossierId: string,
  adminClient = createAdminClient(),
): Promise<boolean> {
  const { data, error } = await adminClient
    .from("ged_dossiers")
    .select("nom")
    .eq("id", gedDossierId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return estDossierBancaire(data.nom);
}

/**
 * Critère synchrone (tests / pré-filtre) : PDF + nom de dossier « Relevé ».
 */
export function doitDeclencherExtractionReleve(params: {
  typeDocument: string;
  nomDossier: string | null | undefined;
}): boolean {
  if (!isPdf(params.typeDocument)) {
    return false;
  }

  if (!params.nomDossier?.trim()) {
    return false;
  }

  return estDossierBancaire(params.nomDossier);
}

export type ImporterReleveFn = (
  documentId: string,
) => Promise<unknown>;

/**
 * Après classement Scan GED : lance l'extraction comme matima-app à l'upload.
 * Les erreurs sont avalées — le document reste classé même si l'extraction échoue.
 */
export async function declencherExtractionReleveApresClassement(
  params: {
    documentId: string;
    typeDocument: string;
    gedDossierId: string | null | undefined;
  },
  options?: {
    /** Pour les tests : injecte le nom de dossier sans aller en base. */
    nomDossier?: string | null;
    importer?: ImporterReleveFn;
  },
): Promise<boolean> {
  if (!isPdf(params.typeDocument) || !params.gedDossierId) {
    return false;
  }

  let nomDossier = options?.nomDossier;
  if (nomDossier === undefined) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ged_dossiers")
      .select("nom")
      .eq("id", params.gedDossierId)
      .maybeSingle();
    nomDossier = data?.nom ?? null;
  }

  if (!doitDeclencherExtractionReleve({
    typeDocument: params.typeDocument,
    nomDossier,
  })) {
    return false;
  }

  const importer = options?.importer ?? importerReleveBancaireDepuisDocument;

  try {
    await importer(params.documentId);
    return true;
  } catch (error) {
    console.error(
      "[declencherExtractionReleveApresClassement]",
      error instanceof Error ? error.message : error,
    );
    return true;
  }
}

/**
 * Fire-and-forget après validation — n'attend pas le résultat.
 */
export function lancerExtractionReleveEnArrierePlan(params: {
  documentId: string;
  typeDocument: string;
  gedDossierId: string | null | undefined;
}): void {
  void declencherExtractionReleveApresClassement(params);
}
