import { createClient } from "@/lib/supabase/client";
import type {
  DocumentNonClasse,
  GedDossier,
  MajeurActif,
} from "@/types/documents";
import type { ScanGedOrganisationContext } from "@/types/scan-ged";

const CONCURRENCE_UPLOAD = 3;
const BUCKET = "documents";

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

async function demanderUrlUploadSignee(
  organisationId: string,
  fichier: File,
): Promise<{ storagePath: string; token: string; path: string }> {
  const response = await fetch(
    `/api/scan-ged/${organisationId}/signed-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: fichier.name,
        typeDocument: fichier.type || "application/octet-stream",
      }),
    },
  );

  let data: {
    storagePath?: string;
    token?: string;
    path?: string;
    error?: string;
  };

  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new Error(
      `Impossible d'obtenir l'URL d'upload (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || !data.storagePath || !data.token) {
    throw new Error(data.error ?? "Impossible d'obtenir l'URL d'upload.");
  }

  return {
    storagePath: data.storagePath,
    token: data.token,
    path: data.path ?? data.storagePath,
  };
}

async function uploaderFichierVersStorage(
  organisationId: string,
  fichier: File,
): Promise<string> {
  const { storagePath, token, path } = await demanderUrlUploadSignee(
    organisationId,
    fichier,
  );

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, fichier, {
      contentType: fichier.type || "application/octet-stream",
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

async function rollbackStoragePaths(
  organisationId: string,
  storagePaths: string[],
): Promise<void> {
  if (storagePaths.length === 0) {
    return;
  }

  try {
    await fetch(`/api/scan-ged/${organisationId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePaths }),
    });
  } catch {
    console.error("[scan-ged] Échec du rollback storage");
  }
}

/**
 * Upload chaque fichier directement vers Storage (URL signée), puis classifie.
 * Erreurs d'upload isolées par fichier ; classification sur les chemins réussis.
 */
export async function uploadScanGedDocuments(
  organisationId: string,
  fichiers: File[],
): Promise<{ documents: DocumentNonClasse[]; erreurs?: string[] }> {
  const storagePaths: string[] = [];
  const erreursUpload: string[] = [];

  for (let debut = 0; debut < fichiers.length; debut += CONCURRENCE_UPLOAD) {
    const lot = fichiers.slice(debut, debut + CONCURRENCE_UPLOAD);

    const resultatsLot = await Promise.allSettled(
      lot.map((fichier) => uploaderFichierVersStorage(organisationId, fichier)),
    );

    resultatsLot.forEach((resultat, index) => {
      const fichier = lot[index]!;
      if (resultat.status === "fulfilled") {
        storagePaths.push(resultat.value);
      } else {
        const message =
          resultat.reason instanceof Error
            ? resultat.reason.message
            : "Échec d'upload.";
        erreursUpload.push(`${fichier.name} : ${message}`);
      }
    });
  }

  if (storagePaths.length === 0) {
    throw new Error(
      erreursUpload.join(" ") || "Aucun fichier n'a pu être téléversé.",
    );
  }

  let classificationReussie = false;

  try {
    const response = await fetch(
      `/api/scan-ged/${organisationId}/classifier`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePaths }),
      },
    );

    let data:
      | { documents: DocumentNonClasse[]; erreurs?: string[] }
      | { error?: string };

    try {
      data = (await response.json()) as typeof data;
    } catch {
      throw new Error(
        `Classification impossible (HTTP ${response.status}).`,
      );
    }

    if (!response.ok || !("documents" in data)) {
      throw new Error(
        "error" in data && data.error
          ? data.error
          : "Impossible de classifier les documents.",
      );
    }

    classificationReussie = true;

    const erreurs = [...erreursUpload, ...(data.erreurs ?? [])];

    return {
      documents: data.documents,
      erreurs: erreurs.length > 0 ? erreurs : undefined,
    };
  } finally {
    if (!classificationReussie) {
      await rollbackStoragePaths(organisationId, storagePaths);
    }
  }
}

export async function validerScanGedDocument(params: {
  documentId: string;
  gedDossierId: string | null;
  nouveauCheminDossier: string[] | null;
  majeurId: string;
  nom: string;
}): Promise<DocumentNonClasse> {
  const response = await fetch(
    `/api/scan-ged/documents/${params.documentId}/valider`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gedDossierId: params.gedDossierId,
        nouveauCheminDossier: params.nouveauCheminDossier,
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
    gedDossierId: string | null;
    nouveauCheminDossier: string[] | null;
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

export type { DocumentNonClasse, GedDossier, MajeurActif };
