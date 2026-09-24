import { proposerDocumentNonClasse } from "@/lib/claude/proposer-document-non-classe";
import {
  buildInboxStoragePath,
  buildStoragePath,
  sanitizeNomFichier,
} from "@/lib/documents/document-utils";
import {
  type SuggestionDossierExistant,
  trouverSuggestionDossierExistant,
} from "@/lib/documents/dossier-similarite";
import {
  type DossierOrganisationRow,
  creerOuRecupererCheminDossier,
  resoudreDossierExistantProposition,
} from "@/lib/documents/ged-dossiers-server";
import { resoudreAConsulterPourDossier } from "@/lib/documents/a-consulter-server";
import { decouperPdfAuxPagesBlanches } from "@/lib/documents/split-pdf-blank-pages";
import { createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentNonClasse } from "@/types/documents";

const BUCKET = "documents";

interface MajeurRow {
  id: string;
  nom: string;
  prenom: string;
}

interface EntreeTeleversee {
  nom: string;
  typeDocument: string;
  bytes: Uint8Array;
  storagePath: string;
}

interface ContexteTraitement {
  organisationId: string;
  dossiers: DossierOrganisationRow[];
  majeurs: MajeurRow[];
  adminClient: SupabaseClient;
}

function estPdf(type: string, nom: string): boolean {
  return type === "application/pdf" || nom.toLowerCase().endsWith(".pdf");
}

function nomDepuisStoragePath(storagePath: string): string {
  const dernier = storagePath.split("/").pop() ?? "document";
  // Retire le préfixe timestamp_uuid_ éventuel → garde un nom lisible
  const sansPrefixe = dernier.replace(/^\d+_[0-9a-f-]+_/i, "");
  return sansPrefixe || dernier;
}

async function telechargerDepuisStorage(
  adminClient: SupabaseClient,
  storagePath: string,
): Promise<{ bytes: Uint8Array; typeDocument: string }> {
  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de télécharger le document.");
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  const typeDocument = data.type || "application/octet-stream";

  return { bytes, typeDocument };
}

async function proposerDepuisBytes(params: {
  nom: string;
  typeDocument: string;
  bytes: Uint8Array;
  dossiers: DossierOrganisationRow[];
  majeurs: MajeurRow[];
}) {
  const pdfBase64 = estPdf(params.typeDocument, params.nom)
    ? Buffer.from(params.bytes).toString("base64")
    : null;

  const imageBase64 = !pdfBase64
    ? Buffer.from(params.bytes).toString("base64")
    : null;

  return proposerDocumentNonClasse({
    nomOriginal: params.nom,
    typeDocument: params.typeDocument,
    dossiers: params.dossiers,
    majeurs: params.majeurs,
    pdfBase64,
    imageBase64,
    imageMediaType: params.typeDocument.startsWith("image/")
      ? params.typeDocument
      : undefined,
  });
}

async function insererDocumentAvecProposition(
  entree: EntreeTeleversee,
  proposition: Awaited<ReturnType<typeof proposerDepuisBytes>>,
  gedDossierId: string | null,
  propositionNouveauCheminDossier: string[] | null,
  suggestionDossierExistant: SuggestionDossierExistant | null,
  contexte: ContexteTraitement,
  index: number,
): Promise<DocumentNonClasse> {
  const { data, error } = await contexte.adminClient
    .from("documents")
    .insert({
      organisation_id: contexte.organisationId,
      majeur_id: null,
      categorie_id: null,
      ged_dossier_id: null,
      storage_path: entree.storagePath,
      type_document: entree.typeDocument,
      nom_original: proposition.nomFichier ?? entree.nom,
      nom_fichier: `${Date.now()}_${index}_${entree.nom}`,
      taille_bytes: entree.bytes.byteLength,
      proposition_categorie_id: null,
      proposition_majeur_id: proposition.majeurId,
      proposition_ged_dossier_id: gedDossierId,
      proposition_nouveau_chemin_dossier: propositionNouveauCheminDossier,
      proposition_suggestion_dossier_existant: suggestionDossierExistant,
      proposition_nom: proposition.nomFichier,
    })
    .select("*")
    .single();

  if (error || !data) {
    await contexte.adminClient.storage
      .from(BUCKET)
      .remove([entree.storagePath]);
    throw new Error(error?.message ?? "Impossible d'enregistrer le document.");
  }

  return data as DocumentNonClasse;
}

/**
 * Pour un fichier déjà en inbox Storage : découpe PDF si besoin, classifie, insert.
 * Les segments PDF sont ré-uploadés en inbox ; l'original multi-pages est retiré.
 */
async function preparerEntreesDepuisStoragePath(
  storagePath: string,
  organisationId: string,
  adminClient: SupabaseClient,
): Promise<EntreeTeleversee[]> {
  const prefixeInbox = `${organisationId}/inbox/`;
  if (
    !storagePath ||
    storagePath.includes("..") ||
    !storagePath.startsWith(prefixeInbox)
  ) {
    throw new Error("Chemin invalide (inbox organisation uniquement).");
  }

  const { data: documentExistant, error: lectureExistantError } =
    await adminClient
      .from("documents")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle();

  if (lectureExistantError) {
    throw new Error(lectureExistantError.message);
  }

  if (documentExistant) {
    throw new Error("Une ligne documents existe déjà pour ce fichier.");
  }

  const telecharge = await telechargerDepuisStorage(adminClient, storagePath);
  const nom = nomDepuisStoragePath(storagePath);
  let typeDocument = telecharge.typeDocument;

  if (estPdf(typeDocument, nom)) {
    typeDocument = "application/pdf";
  }

  if (!estPdf(typeDocument, nom)) {
    return [
      {
        nom,
        typeDocument,
        bytes: telecharge.bytes,
        storagePath,
      },
    ];
  }

  const segments = await decouperPdfAuxPagesBlanches(telecharge.bytes, nom);

  if (segments.length <= 1) {
    const unique = segments[0];
    return [
      {
        nom: unique?.nom ?? nom,
        typeDocument: "application/pdf",
        bytes: unique?.bytes ?? telecharge.bytes,
        storagePath,
      },
    ];
  }

  const entrees: EntreeTeleversee[] = [];

  for (const segment of segments) {
    const cheminSegment = buildInboxStoragePath(organisationId, segment.nom);
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(cheminSegment, segment.bytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    entrees.push({
      nom: segment.nom,
      typeDocument: "application/pdf",
      bytes: segment.bytes,
      storagePath: cheminSegment,
    });
  }

  await adminClient.storage.from(BUCKET).remove([storagePath]);

  return entrees;
}

export async function creerUrlUploadSigneInbox(params: {
  organisationId: string;
  nom: string;
  typeDocument?: string;
}): Promise<{
  storagePath: string;
  token: string;
  signedUrl: string;
  path: string;
}> {
  const adminClient = createAdminClient();
  const storagePath = buildInboxStoragePath(
    params.organisationId,
    params.nom.trim() || "document",
  );

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(
      error?.message ?? "Impossible de générer l'URL d'upload signée.",
    );
  }

  return {
    storagePath: data.path || storagePath,
    token: data.token,
    signedUrl: data.signedUrl,
    path: data.path || storagePath,
  };
}

export async function rollbackStoragePathsInbox(
  storagePaths: string[],
  organisationId: string,
): Promise<void> {
  const adminClient = createAdminClient();
  const prefixeInbox = `${organisationId}/inbox/`;
  const chemins = storagePaths
    .map((path) => path.trim())
    .filter(
      (path) =>
        path.length > 0 &&
        !path.includes("..") &&
        path.startsWith(prefixeInbox),
    );

  if (chemins.length === 0) {
    return;
  }

  await adminClient.storage.from(BUCKET).remove(chemins);
}

export async function classerDocumentsInboxDepuisStoragePaths(params: {
  storagePaths: string[];
  organisationId: string;
  dossiers: DossierOrganisationRow[];
  majeurs: MajeurRow[];
}): Promise<{ documents: DocumentNonClasse[]; erreurs: string[] }> {
  const adminClient = createAdminClient();
  const contexte: ContexteTraitement = {
    organisationId: params.organisationId,
    dossiers: params.dossiers,
    majeurs: params.majeurs,
    adminClient,
  };

  const erreurs: string[] = [];
  const entrees: EntreeTeleversee[] = [];

  for (const storagePath of params.storagePaths) {
    try {
      const preparees = await preparerEntreesDepuisStoragePath(
        storagePath,
        params.organisationId,
        adminClient,
      );
      entrees.push(...preparees);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de préparation.";
      erreurs.push(`${storagePath} : ${message}`);
    }
  }

  if (entrees.length === 0) {
    return { documents: [], erreurs };
  }

  const documents: DocumentNonClasse[] = [];

  for (let index = 0; index < entrees.length; index += 1) {
    const entree = entrees[index]!;
    try {
      const proposition = await proposerDepuisBytes({
        nom: entree.nom,
        typeDocument: entree.typeDocument,
        bytes: entree.bytes,
        dossiers: params.dossiers,
        majeurs: params.majeurs,
      });

      const gedDossierId = resoudreDossierExistantProposition({
        majeurId: proposition.majeurId,
        gedDossierId: proposition.gedDossierId,
        dossiers: params.dossiers,
      });
      const propositionNouveauCheminDossier =
        !gedDossierId && proposition.nouveauCheminDossier?.length
          ? proposition.nouveauCheminDossier
          : null;

      const suggestionDossierExistant =
        propositionNouveauCheminDossier && proposition.majeurId
          ? trouverSuggestionDossierExistant(
              propositionNouveauCheminDossier[0] ?? "",
              params.dossiers.filter(
                (dossier) => dossier.majeur_id === proposition.majeurId,
              ),
            )
          : null;

      const document = await insererDocumentAvecProposition(
        entree,
        proposition,
        gedDossierId,
        propositionNouveauCheminDossier,
        suggestionDossierExistant,
        contexte,
        index,
      );
      documents.push(document);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de classification.";
      erreurs.push(`${entree.nom} : ${message}`);
    }
  }

  return { documents, erreurs };
}

export async function deplacerEtClasserDocument(params: {
  document: DocumentNonClasse;
  gedDossierId: string | null;
  nouveauCheminDossier?: string[] | null;
  majeurId: string;
  nom: string;
}): Promise<DocumentNonClasse> {
  const adminClient = createAdminClient();
  let gedDossierIdFinal = params.gedDossierId;

  const segments = (params.nouveauCheminDossier ?? [])
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 0) {
    const cheminPropositionIa = (
      params.document.proposition_nouveau_chemin_dossier ?? []
    )
      .map((segment) => segment.trim())
      .filter(Boolean);
    const cheminIdentiqueAPropositionIa =
      segments.length === cheminPropositionIa.length &&
      segments.every(
        (segment, index) => segment === cheminPropositionIa[index],
      );

    gedDossierIdFinal = await creerOuRecupererCheminDossier(adminClient, {
      organisationId: params.document.organisation_id,
      majeurId: params.majeurId,
      segments,
      creeParIa: cheminIdentiqueAPropositionIa,
    });
  }

  const nomSecurise = sanitizeNomFichier(
    params.nom.trim() || params.document.nom_original,
  );
  const nouveauChemin = buildStoragePath(
    params.document.organisation_id,
    params.majeurId,
    nomSecurise,
  );

  const { error: copieError } = await adminClient.storage
    .from(BUCKET)
    .copy(params.document.storage_path, nouveauChemin);

  if (copieError) {
    throw new Error(copieError.message);
  }

  await adminClient.storage
    .from(BUCKET)
    .remove([params.document.storage_path]);

  const aConsulter = await resoudreAConsulterPourDossier(adminClient, {
    organisationId: params.document.organisation_id,
    gedDossierId: gedDossierIdFinal,
  });

  const { data, error } = await adminClient
    .from("documents")
    .update({
      majeur_id: params.majeurId,
      ged_dossier_id: gedDossierIdFinal,
      categorie_id: null,
      nom_original: params.nom.trim() || params.document.nom_original,
      storage_path: nouveauChemin,
      a_consulter: aConsulter,
      proposition_categorie_id: null,
      proposition_ged_dossier_id: null,
      proposition_nouveau_chemin_dossier: null,
      proposition_suggestion_dossier_existant: null,
      proposition_majeur_id: null,
      proposition_nom: null,
    })
    .eq("id", params.document.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de classer le document.");
  }

  return data as DocumentNonClasse;
}
