/**
 * Extraction JPEG via coefficients DC uniquement (échelle 1/8),
 * sans IDCT complète — librairie pure JS `jp3g` (pas de dépendance native).
 *
 * Chaque pixel du résultat 1/8 correspond à la valeur DC déquantifiée
 * d'un bloc 8×8 (conversion YCbCr → RGB effectuée par le décodeur).
 */

import jp3g from "jp3g";

/** Facteur d'échelle JPEG = 1 bloc → 1 pixel (DC only). */
export const ECHELLE_JPEG_DC = 1 / 8;

export interface CouleurRgb {
  r: number;
  g: number;
  b: number;
}

let workersInitialises = false;

function assurerJp3gSansWorkers(): void {
  if (workersInitialises) {
    return;
  }
  // Thread principal uniquement (Node / serverless) — pas de workers browser.
  jp3g.setWorkerCount(0);
  workersInitialises = true;
}

function moyenneDepuisRgba(
  data: Uint8ClampedArray | Uint8Array,
  pas = 1
): CouleurRgb {
  const step = Math.max(1, Math.floor(pas));
  let sommeR = 0;
  let sommeG = 0;
  let sommeB = 0;
  let compte = 0;

  for (let i = 0; i + 3 < data.length; i += 4 * step) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 8) {
      continue;
    }
    sommeR += data[i] ?? 0;
    sommeG += data[i + 1] ?? 0;
    sommeB += data[i + 2] ?? 0;
    compte += 1;
  }

  if (compte === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: sommeR / compte,
    g: sommeG / compte,
    b: sommeB / compte,
  };
}

function pixelsDepuisImageData(image: {
  data: Uint8ClampedArray | Uint8Array | number[];
}): Uint8Array {
  if (image.data instanceof Uint8Array) {
    return image.data;
  }
  return Uint8Array.from(image.data);
}

/**
 * Moyenne RGB via decode JPEG à l'échelle 1/8 (coefficients DC).
 * Retourne null si le JPEG est invalide / non supporté.
 */
export async function moyenneRgbDepuisJpegDc(
  jpegBytes: Uint8Array
): Promise<CouleurRgb | null> {
  assurerJp3gSansWorkers();

  try {
    const image = await jp3g(jpegBytes).scale(ECHELLE_JPEG_DC).toImageData();
    if (!image?.data || image.width <= 0 || image.height <= 0) {
      return null;
    }
    // Image déjà ~1/8 : on moyenne tous les pixels DC.
    return moyenneDepuisRgba(pixelsDepuisImageData(image), 1);
  } catch {
    return null;
  }
}
