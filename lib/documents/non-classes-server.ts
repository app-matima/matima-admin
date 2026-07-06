import { proposerDocumentNonClasse } from "@/lib/claude/proposer-document-non-classe";
import {
  buildInboxStoragePath,
  buildStoragePath,
  sanitizeNomFichier,
} from "@/lib/documents/document-utils";
import { decouperPdfAuxPagesBlanches } from "@/lib/documents/split-pdf-blank-pages";
import { createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentNonClasse } from "@/types/documents";

const BUCKET = "documents";

interface CategorieRow {
  id: string;
  nom: string;
}

interface MajeurRow {
  id: string;
  nom: string;
  prenom: string;
}

interface EntreeNonClasse {
  nom: string;
  typeDocument: string;
  bytes: Uint8Array;
}

interface EntreeTeleversee extends EntreeNonClasse {
  storagePath: string;
}

interface ContexteTraitement {
  organisationId: string;
  categories: CategorieRow[];
  majeurs: MajeurRow[];
  adminClient: SupabaseClient;
}

function estFichierAccepte(type: string, nom: string): boolean {
  if (type === "application/pdf" || nom.toLowerCase().endsWith(".pdf")) {
    return true;
  }

  return type.startsWith("image/");
}

function estPdf(type: string, nom: string): boolean {
  return type === "application/pdf" || nom.toLowerCase().endsWith(".pdf");
}

async function preparerEntreesDepuisFichier(
  fichier: File,
): Promise<EntreeNonClasse[]> {
  const typeDocument = fichier.type || "application/octet-stream";
  const nom = fichier.name;

  if (!estFichierAccepte(typeDocument, nom)) {
    throw new Error(`Format non supporté : ${nom}`);
  }

  const buffer = new Uint8Array(await fichier.arrayBuffer());

  if (estPdf(typeDocument, nom)) {
    const segments = await decouperPdfAuxPagesBlanches(buffer, nom);
    return segments.map((segment) => ({
      nom: segment.nom,
      typeDocument: "application/pdf",
      bytes: segment.bytes,
    }));
  }

  return [{ nom, typeDocument, bytes: buffer }];
}

async function televerserEntree(
  entree: EntreeNonClasse,
  organisationId: string,
  adminClient: SupabaseClient,
): Promise<EntreeTeleversee> {
  const storagePath = buildInboxStoragePath(organisationId, entree.nom);

  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, entree.bytes, {
      contentType: entree.typeDocument,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return { ...entree, storagePath };
}

async function proposerDepuisBytes(params: {
  nom: string;
  typeDocument: string;
  bytes: Uint8Array;
  categories: CategorieRow[];
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
    categories: params.categories,
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
  contexte: ContexteTraitement,
  index: number,
): Promise<DocumentNonClasse> {
  const { data, error } = await contexte.adminClient
    .from("documents")
    .insert({
      organisation_id: contexte.organisationId,
      majeur_id: null,
      categorie_id: null,
      storage_path: entree.storagePath,
      type_document: entree.typeDocument,
      nom_original: proposition.nomFichier ?? entree.nom,
      nom_fichier: `${Date.now()}_${index}_${entree.nom}`,
      taille_bytes: entree.bytes.byteLength,
      proposition_categorie_id: proposition.categorieId,
      proposition_majeur_id: proposition.majeurId,
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

export async function traiterFichiersNonClasse(params: {
  fichiers: File[];
  organisationId: string;
  categories: CategorieRow[];
  majeurs: MajeurRow[];
}): Promise<{ documents: DocumentNonClasse[]; erreurs: string[] }> {
  const adminClient = createAdminClient();
  const contexte: ContexteTraitement = {
    organisationId: params.organisationId,
    categories: params.categories,
    majeurs: params.majeurs,
    adminClient,
  };

  const erreurs: string[] = [];
  const entrees: EntreeNonClasse[] = [];

  for (const fichier of params.fichiers) {
    try {
      const entreesFichier = await preparerEntreesDepuisFichier(fichier);
      entrees.push(...entreesFichier);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur d'import.";
      erreurs.push(`${fichier.name} : ${message}`);
    }
  }

  if (entrees.length === 0) {
    return { documents: [], erreurs };
  }

  const televerses = await Promise.all(
    entrees.map((entree) =>
      televerserEntree(entree, params.organisationId, adminClient),
    ),
  );

  const propositions = await Promise.all(
    televerses.map((entree) =>
      proposerDepuisBytes({
        nom: entree.nom,
        typeDocument: entree.typeDocument,
        bytes: entree.bytes,
        categories: params.categories,
        majeurs: params.majeurs,
      }),
    ),
  );

  const documents = await Promise.all(
    televerses.map((entree, index) =>
      insererDocumentAvecProposition(
        entree,
        propositions[index],
        contexte,
        index,
      ),
    ),
  );

  return { documents, erreurs };
}

export async function deplacerEtClasserDocument(params: {
  document: DocumentNonClasse;
  categorieId: string;
  majeurId: string;
  nom: string;
}): Promise<DocumentNonClasse> {
  const adminClient = createAdminClient();
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

  const { data, error } = await adminClient
    .from("documents")
    .update({
      majeur_id: params.majeurId,
      categorie_id: params.categorieId,
      nom_original: params.nom.trim() || params.document.nom_original,
      storage_path: nouveauChemin,
      proposition_categorie_id: null,
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
