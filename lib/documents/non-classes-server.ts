import {
  choisirDossierPourProtege,
  proposerDocumentNonClasse,
  type DossierPourProposition,
} from "@/lib/claude/proposer-document-non-classe";
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
import { chargerDossiersProtege } from "@/lib/documents/charger-dossiers-protege";
import { resoudreAConsulterPourDossier } from "@/lib/documents/a-consulter-server";
import { decouperPdfAuxPagesBlanches } from "@/lib/documents/split-pdf-blank-pages";
import {
  STATUT_CLASSEMENT_ECHEC,
  STATUT_CLASSEMENT_EN_ATTENTE,
  TAILLE_LOT_CLASSEMENT_DEFAUT,
  patchStatutApresClassement,
  traiterPaquetDocumentsIndependamment,
  type DetailTraitementLot,
} from "@/lib/documents/scan-ged-file-attente";
import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentNonClasse, PropositionDocumentIA } from "@/types/documents";

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

function dossiersVersProposition(
  dossiers: { id: string; nom: string; majeur_id: string; parent_id?: string | null }[],
): DossierPourProposition[] {
  return dossiers.map((dossier) => ({
    id: dossier.id,
    nom: dossier.nom,
    majeur_id: dossier.majeur_id,
    parent_id: dossier.parent_id ?? null,
  }));
}

async function chargerDossiersPourProposition(
  majeurId: string,
  organisationId: string,
): Promise<DossierPourProposition[]> {
  const dossiers = await chargerDossiersProtege(majeurId, {
    organisationId,
    colonnes: "id, nom, majeur_id, parent_id",
  });
  return dossiersVersProposition(dossiers);
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
  majeurs: MajeurRow[];
  organisationId: string;
}) {
  const estPdfDoc = estPdf(params.typeDocument, params.nom);
  const pdfBytes = estPdfDoc ? params.bytes : null;
  const imageBase64 = !estPdfDoc
    ? Buffer.from(params.bytes).toString("base64")
    : null;

  return proposerDocumentNonClasse({
    nomOriginal: params.nom,
    typeDocument: params.typeDocument,
    majeurs: params.majeurs,
    chargerDossiers: (majeurId) =>
      chargerDossiersPourProposition(majeurId, params.organisationId),
    pdfBytes,
    imageBase64,
    imageMediaType: params.typeDocument.startsWith("image/")
      ? params.typeDocument
      : undefined,
  });
}

async function insererDocumentEnAttenteClassement(
  entree: EntreeTeleversee,
  organisationId: string,
  adminClient: SupabaseClient,
  index: number,
): Promise<DocumentNonClasse> {
  const { data, error } = await adminClient
    .from("documents")
    .insert({
      organisation_id: organisationId,
      majeur_id: null,
      ged_dossier_id: null,
      storage_path: entree.storagePath,
      type_document: entree.typeDocument,
      nom_original: entree.nom,
      nom_fichier: `${Date.now()}_${index}_${entree.nom}`,
      taille_bytes: entree.bytes.byteLength,
      statut_classement: STATUT_CLASSEMENT_EN_ATTENTE,
      erreur_classement: null,
      proposition_majeur_id: null,
      proposition_ged_dossier_id: null,
      proposition_nouveau_chemin_dossier: null,
      proposition_suggestion_dossier_existant: null,
      proposition_nom: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    await adminClient.storage.from(BUCKET).remove([entree.storagePath]);
    throw new Error(error?.message ?? "Impossible d'enregistrer le document.");
  }

  return data as DocumentNonClasse;
}

async function appliquerPropositionSurDocument(params: {
  adminClient: SupabaseClient;
  documentId: string;
  organisationId: string;
  proposition: PropositionDocumentIA;
}): Promise<DocumentNonClasse> {
  let dossiersProtege: DossierOrganisationRow[] = [];
  if (params.proposition.majeurId) {
    const charges = await chargerDossiersProtege(params.proposition.majeurId, {
      organisationId: params.organisationId,
      colonnes: "id, nom, majeur_id, parent_id",
    });
    dossiersProtege = charges.map((dossier) => ({
      id: dossier.id,
      nom: dossier.nom,
      majeur_id: dossier.majeur_id,
      parent_id: dossier.parent_id ?? null,
    }));
  }

  const gedDossierId = resoudreDossierExistantProposition({
    majeurId: params.proposition.majeurId,
    gedDossierId: params.proposition.gedDossierId,
    dossiers: dossiersProtege,
  });
  const propositionNouveauCheminDossier =
    !gedDossierId && params.proposition.nouveauCheminDossier?.length
      ? params.proposition.nouveauCheminDossier
      : null;

  const suggestionDossierExistant =
    propositionNouveauCheminDossier && params.proposition.majeurId
      ? trouverSuggestionDossierExistant(
          propositionNouveauCheminDossier[0] ?? "",
          dossiersProtege,
        )
      : null;

  const statut = patchStatutApresClassement({ succes: true });

  const majeursUpdates: Record<string, unknown> = {
    proposition_majeur_id: params.proposition.majeurId,
    proposition_ged_dossier_id: gedDossierId,
    proposition_nouveau_chemin_dossier: propositionNouveauCheminDossier,
    proposition_suggestion_dossier_existant: suggestionDossierExistant,
    proposition_nom: params.proposition.nomFichier,
    ...statut,
  };

  if (params.proposition.nomFichier) {
    majeursUpdates.nom_original = params.proposition.nomFichier;
  }

  const { data, error } = await params.adminClient
    .from("documents")
    .update(majeursUpdates)
    .eq("id", params.documentId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Impossible d'enregistrer la proposition IA.",
    );
  }

  return data as DocumentNonClasse;
}

async function marquerEchecClassement(params: {
  adminClient: SupabaseClient;
  documentId: string;
  message: string;
}): Promise<DocumentNonClasse | null> {
  const statut = patchStatutApresClassement({
    succes: false,
    messageErreur: params.message,
  });

  const { data, error } = await params.adminClient
    .from("documents")
    .update(statut)
    .eq("id", params.documentId)
    .select("*")
    .single();

  if (error) {
    console.error("[marquerEchecClassement]", error.message);
    return null;
  }

  return data as DocumentNonClasse;
}

/**
 * Upload déjà fait : découpe PDF si besoin, enregistre chaque segment
 * en « en_attente_classement » SANS lancer l'IA.
 */
export async function enregistrerDocumentsInboxDepuisStoragePaths(params: {
  storagePaths: string[];
  organisationId: string;
}): Promise<{ documents: DocumentNonClasse[]; erreurs: string[] }> {
  const adminClient = createAdminClient();
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
      const document = await insererDocumentEnAttenteClassement(
        entree,
        params.organisationId,
        adminClient,
        index,
      );
      documents.push(document);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur d'enregistrement.";
      erreurs.push(`${entree.nom} : ${message}`);
    }
  }

  return { documents, erreurs };
}

/** @deprecated Utiliser enregistrerDocumentsInboxDepuisStoragePaths */
export async function classerDocumentsInboxDepuisStoragePaths(params: {
  storagePaths: string[];
  organisationId: string;
  majeurs?: MajeurRow[];
}): Promise<{ documents: DocumentNonClasse[]; erreurs: string[] }> {
  return enregistrerDocumentsInboxDepuisStoragePaths({
    storagePaths: params.storagePaths,
    organisationId: params.organisationId,
  });
}

/**
 * Compte les documents en file d'attente (pagination au-delà de 1 000).
 */
export async function compterDocumentsEnAttenteClassement(
  organisationId: string,
  adminClient: SupabaseClient = createAdminClient(),
): Promise<number> {
  const lignes = await chargerToutesLesLignes<{ id: string }>(() =>
    adminClient
      .from("documents")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("statut_classement", STATUT_CLASSEMENT_EN_ATTENTE)
      .is("majeur_id", null),
  );
  return lignes.length;
}

async function classerUnDocumentEnAttente(params: {
  document: DocumentNonClasse;
  organisationId: string;
  majeurs: MajeurRow[];
  adminClient: SupabaseClient;
}): Promise<DocumentNonClasse> {
  const { bytes, typeDocument } = await telechargerDepuisStorage(
    params.adminClient,
    params.document.storage_path,
  );

  const type = typeDocument || params.document.type_document;
  const proposition = await proposerDepuisBytes({
    nom: params.document.nom_original,
    typeDocument: type,
    bytes,
    majeurs: params.majeurs,
    organisationId: params.organisationId,
  });

  return appliquerPropositionSurDocument({
    adminClient: params.adminClient,
    documentId: params.document.id,
    organisationId: params.organisationId,
    proposition,
  });
}

/**
 * Traite un paquet de documents en_attente_classement (ou une liste explicite).
 */
export async function traiterLotClassementScanGed(params: {
  organisationId: string;
  taille?: number;
  documentIds?: string[];
}): Promise<{
  traite: number;
  restant: number;
  details: DetailTraitementLot[];
  documents: DocumentNonClasse[];
}> {
  const adminClient = createAdminClient();
  const taille = Math.min(
    Math.max(params.taille ?? TAILLE_LOT_CLASSEMENT_DEFAUT, 1),
    20,
  );

  const majeurs = await chargerToutesLesLignes<MajeurRow>(() =>
    adminClient
      .from("majeurs")
      .select("id, nom, prenom")
      .eq("organisation_id", params.organisationId)
      .eq("statut", "actif"),
  );

  let aTraiter: DocumentNonClasse[] = [];

  if (params.documentIds && params.documentIds.length > 0) {
    const ids = [...new Set(params.documentIds.filter(Boolean))];
    const { data, error } = await adminClient
      .from("documents")
      .select("*")
      .eq("organisation_id", params.organisationId)
      .is("majeur_id", null)
      .in("id", ids);

    if (error) {
      throw new Error(error.message);
    }

    aTraiter = (data ?? []) as DocumentNonClasse[];

    // Remet en file les échecs avant retraitement
    const aRemettre = aTraiter.filter(
      (doc) => doc.statut_classement === STATUT_CLASSEMENT_ECHEC,
    );
    if (aRemettre.length > 0) {
      await adminClient
        .from("documents")
        .update({
          statut_classement: STATUT_CLASSEMENT_EN_ATTENTE,
          erreur_classement: null,
        })
        .in(
          "id",
          aRemettre.map((doc) => doc.id),
        );
      aTraiter = aTraiter.map((doc) =>
        doc.statut_classement === STATUT_CLASSEMENT_ECHEC
          ? {
              ...doc,
              statut_classement: STATUT_CLASSEMENT_EN_ATTENTE,
              erreur_classement: null,
            }
          : doc,
      );
    }

    aTraiter = aTraiter.filter(
      (doc) =>
        doc.statut_classement === STATUT_CLASSEMENT_EN_ATTENTE ||
        doc.statut_classement === STATUT_CLASSEMENT_ECHEC,
    );
  } else {
    const { data, error } = await adminClient
      .from("documents")
      .select("*")
      .eq("organisation_id", params.organisationId)
      .eq("statut_classement", STATUT_CLASSEMENT_EN_ATTENTE)
      .is("majeur_id", null)
      .order("created_at", { ascending: true })
      .limit(taille);

    if (error) {
      throw new Error(error.message);
    }

    aTraiter = (data ?? []) as DocumentNonClasse[];
  }

  const documentsMisAJour: DocumentNonClasse[] = [];

  const details = await traiterPaquetDocumentsIndependamment(
    aTraiter.map((doc) => ({
      id: doc.id,
      nom: doc.nom_original,
      document: doc,
    })),
    async (item) => {
      try {
        const misAJour = await classerUnDocumentEnAttente({
          document: item.document,
          organisationId: params.organisationId,
          majeurs,
          adminClient,
        });
        documentsMisAJour.push(misAJour);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erreur de classement.";
        const echec = await marquerEchecClassement({
          adminClient,
          documentId: item.id,
          message,
        });
        if (echec) {
          documentsMisAJour.push(echec);
        }
        throw error;
      }
    },
  );

  const restant = await compterDocumentsEnAttenteClassement(
    params.organisationId,
    adminClient,
  );

  return {
    traite: details.length,
    restant,
    details,
    documents: documentsMisAJour,
  };
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

/**
 * Appel B seul : propose un dossier pour un document déjà associé à un protégé
 * (choix manuel admin après identification A manquante).
 */
export async function proposerDossierPourMajeur(params: {
  nom: string;
  typeDocument: string;
  bytes: Uint8Array;
  majeur: MajeurRow;
  organisationId: string;
}): Promise<{
  gedDossierId: string | null;
  nouveauCheminDossier: string[] | null;
  nomFichier: string | null;
  suggestionDossierExistant: SuggestionDossierExistant | null;
}> {
  const dossiers = await chargerDossiersPourProposition(
    params.majeur.id,
    params.organisationId,
  );

  const estPdfDoc = estPdf(params.typeDocument, params.nom);
  const classement = await choisirDossierPourProtege({
    nomOriginal: params.nom,
    typeDocument: params.typeDocument,
    majeur: params.majeur,
    dossiers,
    pdfBytes: estPdfDoc ? params.bytes : null,
    imageBase64: !estPdfDoc
      ? Buffer.from(params.bytes).toString("base64")
      : null,
    imageMediaType: params.typeDocument.startsWith("image/")
      ? params.typeDocument
      : undefined,
  });

  const dossierChoisi =
    classement.gedDossierId ??
    (classement.nouveauCheminDossier
      ? classement.nouveauCheminDossier.join(" > ")
      : null);

  console.log(
    "[proposerDossierPourMajeur]",
    params.nom,
    "majeur_id=",
    params.majeur.id,
    "emetteur=",
    classement.emetteur,
    "type_document=",
    classement.typeDocument,
    "famille=",
    classement.famille,
    "dossier=",
    dossierChoisi,
    "confiance_B=",
    classement.confiance,
    "tokens_B=",
    classement.tokens
      ? `in=${classement.tokens.input} out=${classement.tokens.output} cache_read=${classement.tokens.cache_read}`
      : "n/a",
  );

  const gedDossierId = resoudreDossierExistantProposition({
    majeurId: params.majeur.id,
    gedDossierId: classement.gedDossierId,
    dossiers,
  });

  const nouveauCheminDossier =
    !gedDossierId && classement.nouveauCheminDossier?.length
      ? classement.nouveauCheminDossier
      : null;

  const suggestionDossierExistant =
    nouveauCheminDossier
      ? trouverSuggestionDossierExistant(
          nouveauCheminDossier[0] ?? "",
          dossiers,
        )
      : null;

  return {
    gedDossierId,
    nouveauCheminDossier,
    nomFichier: classement.nomFichier,
    suggestionDossierExistant,
  };
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
      nom_original: params.nom.trim() || params.document.nom_original,
      storage_path: nouveauChemin,
      a_consulter: aConsulter,
      proposition_ged_dossier_id: null,
      proposition_nouveau_chemin_dossier: null,
      proposition_suggestion_dossier_existant: null,
      proposition_majeur_id: null,
      proposition_nom: null,
      erreur_classement: null,
    })
    .eq("id", params.document.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de classer le document.");
  }

  return data as DocumentNonClasse;
}
