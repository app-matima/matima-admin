import { DocumentDejaClasseError } from "@/lib/scan-ged/filtrer-documents-admin";

export const MESSAGE_FICHIER_INTROUVABLE = "Fichier introuvable";

export type ResultatUpdateClassement = "ok" | "deja_classe";

/**
 * Ordre sûr : copy → UPDATE → remove ancien.
 * Si l'UPDATE échoue (ou déjà classé), rollback de la copie.
 */
export async function orchestrerDeplacementClassement(params: {
  copy: () => Promise<void>;
  update: () => Promise<ResultatUpdateClassement>;
  removeAncien: () => Promise<void>;
  removeCopie: () => Promise<void>;
}): Promise<"ok"> {
  await params.copy();

  let resultatUpdate: ResultatUpdateClassement;
  try {
    resultatUpdate = await params.update();
  } catch (error) {
    await params.removeCopie().catch(() => undefined);
    throw error;
  }

  if (resultatUpdate === "deja_classe") {
    await params.removeCopie().catch(() => undefined);
    throw new DocumentDejaClasseError();
  }

  await params.removeAncien();
  return "ok";
}

/** Messages Storage Supabase / S3 typiques pour un objet absent. */
export function estErreurFichierIntrouvable(message: string): boolean {
  const normalise = message.toLowerCase();
  return (
    normalise.includes("not found") ||
    normalise.includes("no such file") ||
    normalise.includes("object not found") ||
    normalise.includes("does not exist") ||
    normalise.includes("404") ||
    normalise.includes("introuvable")
  );
}

export function messageErreurCopieStorage(message: string): string {
  if (estErreurFichierIntrouvable(message)) {
    return MESSAGE_FICHIER_INTROUVABLE;
  }
  return message;
}

export const MAX_DOCUMENTS_VALIDER_TOUT = 25;
export const TAILLE_LOT_VALIDATION_CLIENT = 10;

export const MESSAGE_REPONSE_NON_JSON =
  "Délai dépassé ou erreur serveur — certains documents ont pu être classés. Rechargez la liste.";
