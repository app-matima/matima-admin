/**
 * Découpe un PDF scanné en segments séparés par des feuilles rouges.
 *
 * - Page quasi blanche → retirée, sans démarrer un nouveau document
 * - Page majoritairement rouge → retirée + nouvelle séparation
 * - Autre (contenu) → conservée dans le document en cours
 *
 * Classification couleur via extraction des images XObject :
 * - JPEG (DCTDecode) → coefficients DC uniquement (jp3g échelle 1/8)
 * - FlateDecode → pixels bruts
 * Sans rendu canvas natif — compatible serverless Vercel.
 *
 * Les seuils ci-dessous sont volontairement exposés pour affinage après tests réels.
 */

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFPage,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
  type PDFObject,
} from "pdf-lib";
import { moyenneRgbDepuisJpegDc } from "@/lib/documents/jpeg-dc-moyenne";

// ---------------------------------------------------------------------------
// Seuils / tolérances (ajustables)
// ---------------------------------------------------------------------------

/** Chaque canal R, G, B doit être ≥ ce seuil pour considérer la page comme blanche. */
export const SEUIL_BLANC_RGB_MIN = 245;

/**
 * Rouge : canal R minimum pour être candidat « feuille rouge ».
 * Couvre les rouges papier un peu ternes / scannés.
 */
export const SEUIL_ROUGE_R_MIN = 140;

/** Canaux G et B maximum pour un rouge « pur » (tolérance papier). */
export const SEUIL_ROUGE_GB_MAX = 120;

/**
 * Dominance minimale du rouge : R − max(G, B) ≥ ce seuil.
 * Évite de classer un beige / orange pâle comme séparateur.
 */
export const SEUIL_ROUGE_DOMINANCE = 35;

/** N'échantillonner qu'un pixel sur N pour accélérer la moyenne RGB. */
export const PAS_ECHANTILLONNAGE_PIXELS = 4;

/** Profondeur max de récursion Form XObject (évite les boucles PDF malformés). */
const PROFONDEUR_MAX_FORM_XOBJECT = 8;

// ---------------------------------------------------------------------------

export type TypePagePdf = "blanc" | "rouge" | "contenu";

export interface CouleurMoyenneRgb {
  r: number;
  g: number;
  b: number;
}

export interface SegmentPdf {
  bytes: Uint8Array;
  nom: string;
}

interface ImageXObjectCandidate {
  width: number;
  height: number;
  bitsPerComponent: number;
  colorSpace: string | null;
  filters: string[];
  stream: PDFRawStream;
}

/**
 * Classe une couleur moyenne dominante en blanc / rouge / contenu.
 */
export function classifierCouleurMoyenne(
  couleur: CouleurMoyenneRgb
): TypePagePdf {
  const { r, g, b } = couleur;

  if (
    r >= SEUIL_BLANC_RGB_MIN &&
    g >= SEUIL_BLANC_RGB_MIN &&
    b >= SEUIL_BLANC_RGB_MIN
  ) {
    return "blanc";
  }

  const dominanceRouge = r - Math.max(g, b);
  if (
    r >= SEUIL_ROUGE_R_MIN &&
    g <= SEUIL_ROUGE_GB_MAX &&
    b <= SEUIL_ROUGE_GB_MAX &&
    dominanceRouge >= SEUIL_ROUGE_DOMINANCE
  ) {
    return "rouge";
  }

  return "contenu";
}

/**
 * Moyenne RGB à partir d'un buffer ImageData (RGBA).
 * Ignore les pixels totalement transparents.
 */
export function moyenneRgbDepuisPixels(
  data: Uint8ClampedArray | Uint8Array,
  pas = PAS_ECHANTILLONNAGE_PIXELS
): CouleurMoyenneRgb {
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
    // Aucun pixel opaque → assimilé à blanc (page vide)
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: sommeR / compte,
    g: sommeG / compte,
    b: sommeB / compte,
  };
}

/**
 * Construit les segments de pages à conserver (listes d'indices).
 * - blanc : ignoré (pas de coupure)
 * - rouge : coupure + page ignorée
 * - contenu : ajouté au segment courant
 */
export function detecterSegmentsParTypes(
  types: readonly TypePagePdf[]
): number[][] {
  const segments: number[][] = [];
  let courant: number[] = [];

  for (let index = 0; index < types.length; index += 1) {
    const type = types[index];

    if (type === "rouge") {
      if (courant.length > 0) {
        segments.push(courant);
        courant = [];
      }
      continue;
    }

    if (type === "blanc") {
      continue;
    }

    courant.push(index);
  }

  if (courant.length > 0) {
    segments.push(courant);
  }

  return segments;
}

function nomSegment(nomOriginal: string, index: number, total: number): string {
  if (total <= 1) {
    return nomOriginal;
  }

  const point = nomOriginal.lastIndexOf(".");
  const base = point >= 0 ? nomOriginal.slice(0, point) : nomOriginal;
  const extension = point >= 0 ? nomOriginal.slice(point) : ".pdf";
  return `${base}_partie${index + 1}${extension}`;
}

function refKey(ref: PDFRef): string {
  return `${ref.objectNumber} ${ref.generationNumber}`;
}

function asNameString(value: PDFObject | undefined): string | null {
  if (value instanceof PDFName) {
    return value.decodeText();
  }
  return null;
}

function collectFilterNames(dict: PDFDict): string[] {
  const filter = dict.lookup(PDFName.of("Filter"));
  if (filter instanceof PDFName) {
    return [filter.decodeText()];
  }
  if (filter instanceof PDFArray) {
    const names: string[] = [];
    for (let index = 0; index < filter.size(); index += 1) {
      const item = filter.lookup(index);
      if (item instanceof PDFName) {
        names.push(item.decodeText());
      }
    }
    return names;
  }
  return [];
}

function colorSpaceLabel(value: PDFObject | undefined): string | null {
  if (value instanceof PDFName) {
    return value.decodeText();
  }
  if (value instanceof PDFArray && value.size() > 0) {
    const first = value.lookup(0);
    if (first instanceof PDFName) {
      return first.decodeText();
    }
  }
  return null;
}

function lookupNumber(dict: PDFDict, key: string): number | null {
  const value = dict.lookup(PDFName.of(key));
  if (value instanceof PDFNumber) {
    return value.asNumber();
  }
  return null;
}

function predictorValue(dict: PDFDict): number {
  const parms = dict.lookup(PDFName.of("DecodeParms"));
  if (!(parms instanceof PDFDict)) {
    return 1;
  }
  const predictor = parms.lookup(PDFName.of("Predictor"));
  if (predictor instanceof PDFNumber) {
    return predictor.asNumber();
  }
  return 1;
}

function collectImagesFromResources(
  resources: PDFDict | undefined,
  context: PDFDocument["context"],
  visited: Set<string>,
  profondeur: number,
  acc: ImageXObjectCandidate[]
): void {
  if (!resources || profondeur > PROFONDEUR_MAX_FORM_XOBJECT) {
    return;
  }

  const xObjectDict = resources.lookup(PDFName.of("XObject"));
  if (!(xObjectDict instanceof PDFDict)) {
    return;
  }

  for (const key of xObjectDict.keys()) {
    try {
      const entry = xObjectDict.get(key);
      let stream: PDFObject | undefined;
      let visitId: string | null = null;

      if (entry instanceof PDFRef) {
        visitId = refKey(entry);
        if (visited.has(visitId)) {
          continue;
        }
        visited.add(visitId);
        stream = context.lookup(entry);
      } else {
        stream = entry;
      }

      if (!(stream instanceof PDFRawStream)) {
        continue;
      }

      const subtype = asNameString(stream.dict.lookup(PDFName.of("Subtype")));

      if (subtype === "Image") {
        const width = lookupNumber(stream.dict, "Width");
        const height = lookupNumber(stream.dict, "Height");
        if (width === null || height === null || width <= 0 || height <= 0) {
          continue;
        }

        acc.push({
          width,
          height,
          bitsPerComponent: lookupNumber(stream.dict, "BitsPerComponent") ?? 8,
          colorSpace: colorSpaceLabel(
            stream.dict.lookup(PDFName.of("ColorSpace"))
          ),
          filters: collectFilterNames(stream.dict),
          stream,
        });
        continue;
      }

      if (subtype === "Form") {
        const formResources = stream.dict.lookup(PDFName.of("Resources"));
        const resolved =
          formResources instanceof PDFRef
            ? context.lookup(formResources)
            : formResources;
        if (resolved instanceof PDFDict) {
          collectImagesFromResources(
            resolved,
            context,
            visited,
            profondeur + 1,
            acc
          );
        }
      }
    } catch (error) {
      console.warn(
        "[split-pdf] XObject ignoré:",
        key.decodeText(),
        error instanceof Error ? error.message : error
      );
    }
  }
}

function imagesDeLaPage(page: PDFPage): ImageXObjectCandidate[] {
  const resources = page.node.Resources();
  if (!(resources instanceof PDFDict)) {
    return [];
  }

  const acc: ImageXObjectCandidate[] = [];
  collectImagesFromResources(
    resources,
    page.doc.context,
    new Set<string>(),
    0,
    acc
  );
  return acc;
}

/** Image dominante = plus grande surface (scan pleine page). */
function choisirImageDominante(
  images: readonly ImageXObjectCandidate[]
): ImageXObjectCandidate | null {
  if (images.length === 0) {
    return null;
  }

  let meilleure = images[0]!;
  let meilleureSurface = meilleure.width * meilleure.height;

  for (let index = 1; index < images.length; index += 1) {
    const candidate = images[index]!;
    const surface = candidate.width * candidate.height;
    if (surface > meilleureSurface) {
      meilleure = candidate;
      meilleureSurface = surface;
    }
  }

  return meilleure;
}

function rgbaDepuisRgbOuGray(
  samples: Uint8Array,
  width: number,
  height: number,
  composants: 1 | 3
): Uint8Array | null {
  const attendu = width * height * composants;
  if (samples.length < attendu) {
    return null;
  }

  const rgba = new Uint8Array(width * height * 4);
  if (composants === 1) {
    for (let pixel = 0, src = 0; pixel < width * height; pixel += 1, src += 1) {
      const gray = samples[src] ?? 0;
      const dst = pixel * 4;
      rgba[dst] = gray;
      rgba[dst + 1] = gray;
      rgba[dst + 2] = gray;
      rgba[dst + 3] = 255;
    }
    return rgba;
  }

  for (
    let pixel = 0, src = 0;
    pixel < width * height;
    pixel += 1, src += 3
  ) {
    const dst = pixel * 4;
    rgba[dst] = samples[src] ?? 0;
    rgba[dst + 1] = samples[src + 1] ?? 0;
    rgba[dst + 2] = samples[src + 2] ?? 0;
    rgba[dst + 3] = 255;
  }
  return rgba;
}

/**
 * Annule le filtre PNG (Predictors 10–15) sur des échantillons bruts.
 * Retourne null si la taille ou le filtre est incohérent.
 */
function defiltrerPredictorsPng(
  data: Uint8Array,
  width: number,
  height: number,
  octetsParPixel: number
): Uint8Array | null {
  const stride = width * octetsParPixel;
  const rowSize = stride + 1;
  if (data.length < rowSize * height || octetsParPixel <= 0) {
    return null;
  }

  const output = new Uint8Array(stride * height);
  let prevRow = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowSize;
    const filterType = data[rowOffset] ?? 0;
    const rawRow = data.subarray(rowOffset + 1, rowOffset + 1 + stride);
    const outRow = output.subarray(y * stride, y * stride + stride);

    for (let i = 0; i < stride; i += 1) {
      const x = rawRow[i] ?? 0;
      const a = i >= octetsParPixel ? (outRow[i - octetsParPixel] ?? 0) : 0;
      const b = prevRow[i] ?? 0;
      const c =
        i >= octetsParPixel ? (prevRow[i - octetsParPixel] ?? 0) : 0;

      let value: number;
      switch (filterType) {
        case 0:
          value = x;
          break;
        case 1:
          value = (x + a) & 0xff;
          break;
        case 2:
          value = (x + b) & 0xff;
          break;
        case 3:
          value = (x + Math.floor((a + b) / 2)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          value = (x + pr) & 0xff;
          break;
        }
        default:
          return null;
      }
      outRow[i] = value;
    }

    prevRow = Uint8Array.from(outRow);
  }

  return output;
}

function decoderJpegEnMoyenne(
  candidate: ImageXObjectCandidate
): Promise<CouleurMoyenneRgb | null> {
  // CMYK JPEG non supporté de façon fiable en JS pur → contenu
  if (candidate.colorSpace === "DeviceCMYK") {
    return Promise.resolve(null);
  }

  return moyenneRgbDepuisJpegDc(candidate.stream.contents);
}

function decoderFlateEnRgba(
  candidate: ImageXObjectCandidate
): Uint8Array | null {
  if (candidate.bitsPerComponent !== 8) {
    return null;
  }

  const cs = candidate.colorSpace;
  let composants: 1 | 3 | null = null;
  if (cs === "DeviceGray" || cs === "CalGray") {
    composants = 1;
  } else if (
    cs === "DeviceRGB" ||
    cs === "CalRGB" ||
    cs === null ||
    cs === "ICCBased"
  ) {
    // ICCBased sans profil résolu : on tente RGB 3 composantes (cas scan courant).
    composants = 3;
  } else {
    return null;
  }

  let samples: Uint8Array;
  try {
    samples = decodePDFRawStream(candidate.stream).decode();
  } catch {
    return null;
  }

  const predictor = predictorValue(candidate.stream.dict);
  if (predictor >= 10) {
    const defiltres = defiltrerPredictorsPng(
      samples,
      candidate.width,
      candidate.height,
      composants
    );
    if (!defiltres) {
      return null;
    }
    samples = defiltres;
  } else if (predictor > 1) {
    // Predictor TIFF / autres : non géré → contenu
    return null;
  }

  return rgbaDepuisRgbOuGray(
    samples,
    candidate.width,
    candidate.height,
    composants
  );
}

/**
 * Couleur moyenne de l'image dominante d'une page.
 * JPEG → DC only (1/8) ; Flate → pixels bruts.
 * null → le caller traite en « contenu ».
 */
async function couleurMoyenneDepuisImage(
  candidate: ImageXObjectCandidate
): Promise<CouleurMoyenneRgb | null> {
  const filters = candidate.filters;

  if (filters.includes("DCTDecode") || filters.includes("DCT")) {
    return decoderJpegEnMoyenne(candidate);
  }

  if (
    filters.length === 0 ||
    (filters.length === 1 && filters[0] === "FlateDecode")
  ) {
    const rgba = decoderFlateEnRgba(candidate);
    if (!rgba) {
      return null;
    }
    return moyenneRgbDepuisPixels(rgba);
  }

  // JPXDecode, CCITTFaxDecode, JBIG2, filtres composés non gérés → contenu
  return null;
}

async function classifierUnePage(
  page: PDFPage,
  numero: number
): Promise<TypePagePdf> {
  try {
    const images = imagesDeLaPage(page);
    const dominante = choisirImageDominante(images);

    if (!dominante) {
      console.warn(
        "[split-pdf] page sans image XObject — contenu:",
        numero
      );
      return "contenu";
    }

    const moyenne = await couleurMoyenneDepuisImage(dominante);
    if (!moyenne) {
      console.warn(
        "[split-pdf] page image non décodable — contenu:",
        numero,
        dominante.filters.join("|") || "none",
        dominante.colorSpace ?? "?"
      );
      return "contenu";
    }

    const type = classifierCouleurMoyenne(moyenne);

    console.log(
      "[split-pdf] page classée:",
      numero,
      moyenne.r.toFixed(1),
      moyenne.g.toFixed(1),
      moyenne.b.toFixed(1),
      type
    );

    return type;
  } catch (error) {
    console.warn(
      "[split-pdf] page erreur classification — contenu:",
      numero,
      error instanceof Error ? error.message : error
    );
    return "contenu";
  }
}

/**
 * Classifie chaque page via l'image XObject dominante (scan typique = 1 JPEG pleine page).
 * Jamais d'exception remontée page par page : échec → « contenu ».
 */
export async function classifierPagesParImages(
  pdfBytes: Uint8Array
): Promise<TypePagePdf[]> {
  const doc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const pages = doc.getPages();
  const types: TypePagePdf[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    types.push(await classifierUnePage(pages[index]!, index + 1));
  }

  const nbBlanc = types.filter((t) => t === "blanc").length;
  const nbRouge = types.filter((t) => t === "rouge").length;
  const nbContenu = types.filter((t) => t === "contenu").length;
  console.log(
    "[split-pdf] résumé pages:",
    pages.length,
    "blanc=",
    nbBlanc,
    "rouge=",
    nbRouge,
    "contenu=",
    nbContenu
  );

  return types;
}

/**
 * Découpe un PDF aux feuilles séparatrices rouges.
 * Les pages blanches sont retirées sans créer de coupure.
 */
export async function decouperPdfAuxPagesBlanches(
  pdfBytes: Uint8Array,
  nomOriginal: string
): Promise<SegmentPdf[]> {
  const source = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const nombrePages = source.getPageCount();

  if (nombrePages === 0) {
    return [{ bytes: pdfBytes, nom: nomOriginal }];
  }

  let types: TypePagePdf[];
  try {
    types = await classifierPagesParImages(pdfBytes);
  } catch (error) {
    console.error(
      "[split-pdf] Échec de la classification — conservation du PDF intact.",
      error
    );
    return [{ bytes: pdfBytes, nom: nomOriginal }];
  }

  if (types.length !== nombrePages) {
    console.error(
      "[split-pdf] Nombre de pages classifiées incohérent — PDF intact."
    );
    return [{ bytes: pdfBytes, nom: nomOriginal }];
  }

  const segments = detecterSegmentsParTypes(types);

  if (segments.length === 0) {
    // Uniquement blanc / rouge : rien à conserver → PDF original intact
    // (évite de renvoyer une liste vide à l'upload).
    return [{ bytes: pdfBytes, nom: nomOriginal }];
  }

  // Aucune page à retirer ni coupure → même PDF
  const toutesContenu = types.every((type) => type === "contenu");
  if (toutesContenu && segments.length === 1) {
    return [{ bytes: pdfBytes, nom: nomOriginal }];
  }

  const resultats: SegmentPdf[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    try {
      const indices = segments[index]!;
      const cible = await PDFDocument.create();
      const pages = await cible.copyPages(source, indices);

      for (const page of pages) {
        cible.addPage(page);
      }

      resultats.push({
        bytes: await cible.save(),
        nom: nomSegment(nomOriginal, index, segments.length),
      });
    } catch (error) {
      console.error(
        "[split-pdf] Échec construction segment — PDF intact:",
        index + 1,
        segments.length,
        error
      );
      return [{ bytes: pdfBytes, nom: nomOriginal }];
    }
  }

  return resultats;
}
