"use client";

import {
  MAX_HASH_PAR_APPEL_VERIFICATION,
  octetsVersSha256Hex,
  type FichierAvecEmpreinte,
} from "@/lib/documents/scan-ged-empreintes";

/**
 * Calcule le SHA-256 d'un File (séquentiel, un à la fois).
 * Retourne null si SubtleCrypto indisponible ou échec (fichier trop gros, etc.).
 */
export async function calculerSha256Fichier(
  fichier: File,
): Promise<string | null> {
  if (
    typeof crypto === "undefined" ||
    !crypto.subtle ||
    typeof crypto.subtle.digest !== "function"
  ) {
    return null;
  }

  try {
    const buffer = await fichier.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return octetsVersSha256Hex(digest);
  } catch {
    return null;
  }
}

/**
 * Hash séquentiel de tous les fichiers avec progression X sur Y.
 */
export async function calculerEmpreintesFichiersSequentiel(
  fichiers: File[],
  onProgress?: (progress: { fait: number; total: number }) => void,
): Promise<FichierAvecEmpreinte[]> {
  const total = fichiers.length;
  const resultats: FichierAvecEmpreinte[] = [];

  onProgress?.({ fait: 0, total: Math.max(total, 1) });

  for (let index = 0; index < fichiers.length; index += 1) {
    const fichier = fichiers[index]!;
    const contenuSha256 = await calculerSha256Fichier(fichier);
    resultats.push({
      index,
      nom: fichier.name,
      contenuSha256,
    });
    onProgress?.({ fait: index + 1, total: Math.max(total, 1) });
  }

  return resultats;
}

export { MAX_HASH_PAR_APPEL_VERIFICATION };
