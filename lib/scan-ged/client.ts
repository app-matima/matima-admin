import type {
  CategorieDocument,
  DocumentNonClasse,
  MajeurActif,
} from "@/types/documents";
import type { ScanGedOrganisationContext } from "@/types/scan-ged";

export async function fetchScanGedContext(
  organisationId: string,
): Promise<ScanGedOrganisationContext> {
  const response = await fetch(`/api/scan-ged/${organisationId}/context`);

  const data = (await response.json()) as ScanGedOrganisationContext & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de charger le contexte.");
  }

  return data;
}

export async function uploadScanGedDocuments(
  organisationId: string,
  fichiers: File[],
): Promise<{ documents: DocumentNonClasse[]; erreurs?: string[] }> {
  const formData = new FormData();

  for (const fichier of fichiers) {
    formData.append("fichiers", fichier);
  }

  const response = await fetch(`/api/scan-ged/${organisationId}/upload`, {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as
    | { documents: DocumentNonClasse[]; erreurs?: string[] }
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in data && data.error
        ? data.error
        : "Impossible d'importer les documents.",
    );
  }

  return data as { documents: DocumentNonClasse[]; erreurs?: string[] };
}

export async function validerScanGedDocument(params: {
  documentId: string;
  categorieId: string;
  majeurId: string;
  nom: string;
}): Promise<DocumentNonClasse> {
  const response = await fetch(
    `/api/scan-ged/documents/${params.documentId}/valider`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categorieId: params.categorieId,
        majeurId: params.majeurId,
        nom: params.nom,
      }),
    },
  );

  const data = (await response.json()) as DocumentNonClasse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de valider le document.");
  }

  return data;
}

export async function validerTousScanGedDocuments(
  documents: {
    documentId: string;
    categorieId: string;
    majeurId: string;
    nom: string;
  }[],
): Promise<{ succes: number; erreurs?: string[] }> {
  const response = await fetch("/api/scan-ged/documents/valider-tout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });

  const data = (await response.json()) as {
    succes?: number;
    erreurs?: string[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de tout valider.");
  }

  return { succes: data.succes ?? 0, erreurs: data.erreurs };
}

export type { CategorieDocument, DocumentNonClasse, MajeurActif };
