import { createClient } from "@/lib/supabase/client";
import {
  MESSAGE_REPONSE_NON_JSON,
  TAILLE_LOT_VALIDATION_CLIENT,
} from "@/lib/documents/orchestrer-deplacement-classement";
import type {
  DocumentNonClasse,
  GedDossier,
  MajeurActif,
} from "@/types/documents";
import type { ScanGedOrganisationContext } from "@/types/scan-ged";

const CONCURRENCE_UPLOAD = 3;
const BUCKET = "documents";

export interface ErreurValidationDocumentClient {
  documentId: string;
  message: string;
}

export interface ResultatValiderToutClient {
  succes: number;
  valides: string[];
  conflits: string[];
  erreurs: ErreurValidationDocumentClient[];
  /** Erreurs de lot entier (timeout / non-JSON / HTTP) — le lot suivant a quand même été tenté. */
  erreursLots: string[];
}

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

export async function fetchDossiersProtege(
  organisationId: string,
  majeurId: string,
): Promise<GedDossier[]> {
  if (!majeurId) {
    return [];
  }

  const response = await fetch(
    `/api/scan-ged/${organisationId}/dossiers?majeurId=${encodeURIComponent(majeurId)}`,
  );

  const data = (await response.json()) as {
    dossiers?: GedDossier[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de charger les dossiers.");
  }

  return data.dossiers ?? [];
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
 * Upload chaque fichier vers Storage, enregistre en file d'attente, puis
 * traite le classement IA par paquets jusqu'à épuisement.
 */
export async function uploadScanGedDocuments(
  organisationId: string,
  fichiers: File[],
  options?: {
    onProgress?: (progress: { fait: number; total: number }) => void;
    tailleLot?: number;
  },
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

  let enregistrementReussi = false;
  const documentsParId = new Map<string, DocumentNonClasse>();

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
        `Enregistrement impossible (HTTP ${response.status}).`,
      );
    }

    if (!response.ok || !("documents" in data)) {
      throw new Error(
        "error" in data && data.error
          ? data.error
          : "Impossible d'enregistrer les documents.",
      );
    }

    enregistrementReussi = true;

    for (const document of data.documents) {
      documentsParId.set(document.id, document);
    }

    const erreursPrep = [...erreursUpload, ...(data.erreurs ?? [])];
    const totalInitial = data.documents.length;
    let fait = 0;

    options?.onProgress?.({ fait: 0, total: Math.max(totalInitial, 1) });

    let restant = totalInitial;
    let gardeFou = 0;

    while (restant > 0 && gardeFou < 10_000) {
      gardeFou += 1;
      const lot = await traiterLotScanGed(organisationId, {
        taille: options?.tailleLot,
      });

      for (const document of lot.documents) {
        documentsParId.set(document.id, document);
      }

      fait += lot.traite;
      restant = lot.restant;
      const totalAffiche = Math.max(fait + restant, totalInitial);
      options?.onProgress?.({
        fait: Math.min(fait, totalAffiche),
        total: totalAffiche,
      });

      if (lot.traite === 0) {
        break;
      }
    }

    return {
      documents: Array.from(documentsParId.values()),
      erreurs: erreursPrep.length > 0 ? erreursPrep : undefined,
    };
  } finally {
    if (!enregistrementReussi) {
      await rollbackStoragePaths(organisationId, storagePaths);
    }
  }
}

export async function traiterLotScanGed(
  organisationId: string,
  options?: { taille?: number; documentIds?: string[] },
): Promise<{
  traite: number;
  restant: number;
  details: {
    documentId: string;
    nom: string;
    statut: string;
    erreur: string | null;
  }[];
  documents: DocumentNonClasse[];
}> {
  const response = await fetch(
    `/api/scan-ged/${organisationId}/traiter-lot`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taille: options?.taille,
        documentIds: options?.documentIds,
      }),
    },
  );

  const data = (await response.json()) as {
    traite?: number;
    restant?: number;
    details?: {
      documentId: string;
      nom: string;
      statut: string;
      erreur: string | null;
    }[];
    documents?: DocumentNonClasse[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de traiter le lot.");
  }

  return {
    traite: data.traite ?? 0,
    restant: data.restant ?? 0,
    details: data.details ?? [],
    documents: data.documents ?? [],
  };
}

export async function reessayerClassementScanGedDocument(params: {
  organisationId: string;
  documentId: string;
}): Promise<DocumentNonClasse> {
  const lot = await traiterLotScanGed(params.organisationId, {
    documentIds: [params.documentId],
  });

  const document = lot.documents.find((item) => item.id === params.documentId);
  if (!document) {
    throw new Error("Document introuvable après nouvelle tentative.");
  }

  return document;
}

async function lireJsonReponse<T extends { error?: string }>(
  response: Response,
  messageDefaut: string,
): Promise<T> {
  const texte = await response.text();
  let data: T;

  try {
    data = JSON.parse(texte) as T;
  } catch {
    throw new Error(MESSAGE_REPONSE_NON_JSON);
  }

  if (!response.ok) {
    throw new Error(data.error?.trim() || messageDefaut);
  }

  return data;
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

  return lireJsonReponse<DocumentNonClasse & { error?: string }>(
    response,
    "Impossible de valider le document.",
  );
}

export async function supprimerScanGedDocument(
  documentId: string,
): Promise<void> {
  const response = await fetch(`/api/scan-ged/documents/${documentId}`, {
    method: "DELETE",
  });

  const data = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de supprimer le document.");
  }
}

/**
 * Après choix manuel d'un protégé : relance l'appel B et met à jour la proposition.
 */
export async function proposerDossierScanGedDocument(params: {
  organisationId: string;
  documentId: string;
  majeurId: string;
}): Promise<DocumentNonClasse> {
  const response = await fetch(
    `/api/scan-ged/${params.organisationId}/documents/${params.documentId}/proposer-dossier`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ majeurId: params.majeurId }),
    },
  );

  const data = (await response.json()) as DocumentNonClasse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de proposer un dossier.");
  }

  return data;
}

type DocumentValidationParams = {
  documentId: string;
  gedDossierId: string | null;
  nouveauCheminDossier: string[] | null;
  majeurId: string;
  nom: string;
};

async function validerLotScanGedDocuments(
  documents: DocumentValidationParams[],
): Promise<ResultatValiderToutClient> {
  const response = await fetch("/api/scan-ged/documents/valider-tout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });

  const texte = await response.text();
  let data: {
    succes?: number;
    valides?: string[];
    conflits?: string[];
    erreurs?: ErreurValidationDocumentClient[] | string[];
    error?: string;
  };

  try {
    data = JSON.parse(texte) as typeof data;
  } catch {
    throw new Error(MESSAGE_REPONSE_NON_JSON);
  }

  if (!response.ok) {
    // Lot partiellement documenté dans le JSON (ex. trop de docs, tous en erreur)
    const erreursNormalisees = normaliserErreursLot(data.erreurs);
    if (
      (data.valides?.length ?? 0) > 0 ||
      (data.conflits?.length ?? 0) > 0 ||
      erreursNormalisees.length > 0
    ) {
      return {
        succes: data.succes ?? data.valides?.length ?? 0,
        valides: data.valides ?? [],
        conflits: data.conflits ?? [],
        erreurs: erreursNormalisees,
        erreursLots: data.error ? [data.error] : [],
      };
    }
    throw new Error(data.error?.trim() || "Impossible de tout valider.");
  }

  return {
    succes: data.succes ?? data.valides?.length ?? 0,
    valides: data.valides ?? [],
    conflits: data.conflits ?? [],
    erreurs: normaliserErreursLot(data.erreurs),
    erreursLots: [],
  };
}

function normaliserErreursLot(
  erreurs: ErreurValidationDocumentClient[] | string[] | undefined,
): ErreurValidationDocumentClient[] {
  if (!erreurs?.length) {
    return [];
  }

  return erreurs.map((erreur) => {
    if (typeof erreur === "string") {
      const sep = erreur.indexOf(" : ");
      if (sep > 0) {
        return {
          documentId: erreur.slice(0, sep),
          message: erreur.slice(sep + 3),
        };
      }
      return { documentId: "", message: erreur };
    }
    return erreur;
  });
}

/**
 * Valide par lots de 10 (séquentiel). Un lot en erreur n'arrête pas les suivants.
 */
export async function validerTousScanGedDocuments(
  documents: DocumentValidationParams[],
  options?: {
    onProgress?: (progress: { fait: number; total: number }) => void;
    tailleLot?: number;
  },
): Promise<ResultatValiderToutClient> {
  const tailleLot = Math.max(
    1,
    options?.tailleLot ?? TAILLE_LOT_VALIDATION_CLIENT,
  );
  const total = documents.length;
  const valides: string[] = [];
  const conflits: string[] = [];
  const erreurs: ErreurValidationDocumentClient[] = [];
  const erreursLots: string[] = [];
  let fait = 0;

  options?.onProgress?.({ fait: 0, total: Math.max(total, 1) });

  for (let debut = 0; debut < documents.length; debut += tailleLot) {
    const lot = documents.slice(debut, debut + tailleLot);

    try {
      const resultat = await validerLotScanGedDocuments(lot);
      valides.push(...resultat.valides);
      conflits.push(...resultat.conflits);
      erreurs.push(...resultat.erreurs);
      erreursLots.push(...resultat.erreursLots);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de tout valider.";
      erreursLots.push(message);
      // Les docs de ce lot restent potentiellement en attente ; on continue.
    }

    fait = Math.min(debut + lot.length, total);
    options?.onProgress?.({ fait, total: Math.max(total, 1) });
  }

  return {
    succes: valides.length,
    valides,
    conflits,
    erreurs,
    erreursLots,
  };
}

export type { DocumentNonClasse, GedDossier, MajeurActif };
