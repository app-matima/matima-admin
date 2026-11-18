/**
 * Découpe un PDF scanné aux feuilles séparatrices rouges.
 *
 * Séparateur (jeté) : ≥ 92 % pixels rouges ET ≤ 3 % pixels non rouges.
 * Douteux (conservé) : rouge ≥ 85 % et non rouge ≤ 8 %.
 * Blanc / contenu / douteux : toujours conservés.
 *
 * Classification via images XObject (JPEG plein via jpeg-js, Flate RGBA).
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
import jpegJs from "jpeg-js";

// ---------------------------------------------------------------------------
// Seuils
// ---------------------------------------------------------------------------

export const SEUIL_BLANC_RGB_MIN = 245;

export const SEUIL_ROUGE_PIXEL_R_MIN = 140;
export const SEUIL_ROUGE_PIXEL_GB_MAX = 120;
export const SEUIL_ROUGE_PIXEL_DOMINANCE = 35;

export const SEUIL_SEPARATEUR_PCT_ROUGE_MIN = 0.92;
export const SEUIL_SEPARATEUR_PCT_NON_ROUGE_MAX = 0.03;

export const SEUIL_DOUTEUX_PCT_ROUGE_MIN = 0.85;
export const SEUIL_DOUTEUX_PCT_NON_ROUGE_MAX = 0.08;

/** @deprecated alias */
export const SEUIL_ROUGE_R_MIN = SEUIL_ROUGE_PIXEL_R_MIN;
export const SEUIL_ROUGE_GB_MAX = SEUIL_ROUGE_PIXEL_GB_MAX;
export const SEUIL_ROUGE_DOMINANCE = SEUIL_ROUGE_PIXEL_DOMINANCE;

export const PAS_ECHANTILLONNAGE_PIXELS = 1;

export const MESSAGE_ANOMALIE_DECOUPAGE_PDF =
  "Découpage incohérent : le document a été conservé entier.";

export const MESSAGE_ANOMALIE_TROP_DE_SEPARATEURS =
  "Trop de pages seraient retirées (> 50 %) : le document a été conservé entier.";

const PROFONDEUR_MAX_FORM_XOBJECT = 8;

// ---------------------------------------------------------------------------

export type TypePagePdf = "blanc" | "rouge" | "contenu" | "douteux";

export interface CouleurMoyenneRgb {
  r: number;
  g: number;
  b: number;
}

export interface SegmentPdf {
  bytes: Uint8Array;
  nom: string;
}

export interface DiagnosticPagePdf {
  numero: number;
  type: TypePagePdf;
  moyenne: CouleurMoyenneRgb;
  proportionRouge: number;
  proportionNonRouge: number;
  renduOk: boolean;
  message?: string;
}

export interface ResultatDecoupagePdf {
  segments: SegmentPdf[];
  anomalie: string | null;
  archiveOriginaleRequise: boolean;
  diagnostics: DiagnosticPagePdf[];
  pagesSepareurs: number[];
  pagesDouteuses: number[];
}

export interface AnalysePixelsPage {
  moyenne: CouleurMoyenneRgb;
  proportionRouge: number;
  proportionNonRouge: number;
  type: TypePagePdf;
}

interface ImageXObjectCandidate {
  width: number;
  height: number;
  bitsPerComponent: number;
  colorSpace: string | null;
  filters: string[];
  stream: PDFRawStream;
}

export function estPixelRougeSeparateur(
  r: number,
  g: number,
  b: number
): boolean {
  const dominanceRouge = r - Math.max(g, b);
  return (
    r >= SEUIL_ROUGE_PIXEL_R_MIN &&
    g <= SEUIL_ROUGE_PIXEL_GB_MAX &&
    b <= SEUIL_ROUGE_PIXEL_GB_MAX &&
    dominanceRouge >= SEUIL_ROUGE_PIXEL_DOMINANCE
  );
}

export function classifierDepuisProportions(params: {
  proportionRouge: number;
  proportionNonRouge: number;
  moyenne: CouleurMoyenneRgb;
}): TypePagePdf {
  const { proportionRouge, proportionNonRouge, moyenne } = params;

  if (
    proportionRouge >= SEUIL_SEPARATEUR_PCT_ROUGE_MIN &&
    proportionNonRouge <= SEUIL_SEPARATEUR_PCT_NON_ROUGE_MAX
  ) {
    return "rouge";
  }

  if (
    proportionRouge >= SEUIL_DOUTEUX_PCT_ROUGE_MIN &&
    proportionNonRouge <= SEUIL_DOUTEUX_PCT_NON_ROUGE_MAX
  ) {
    return "douteux";
  }

  if (
    moyenne.r >= SEUIL_BLANC_RGB_MIN &&
    moyenne.g >= SEUIL_BLANC_RGB_MIN &&
    moyenne.b >= SEUIL_BLANC_RGB_MIN
  ) {
    return "blanc";
  }

  return "contenu";
}

export function analyserPixelsPage(
  data: Uint8ClampedArray | Uint8Array
): AnalysePixelsPage {
  let sommeR = 0;
  let sommeG = 0;
  let sommeB = 0;
  let compte = 0;
  let compteRouge = 0;

  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 8) {
      continue;
    }
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    sommeR += r;
    sommeG += g;
    sommeB += b;
    compte += 1;
    if (estPixelRougeSeparateur(r, g, b)) {
      compteRouge += 1;
    }
  }

  if (compte === 0) {
    const moyenne = { r: 255, g: 255, b: 255 };
    return {
      moyenne,
      proportionRouge: 0,
      proportionNonRouge: 1,
      type: "blanc",
    };
  }

  const moyenne = {
    r: sommeR / compte,
    g: sommeG / compte,
    b: sommeB / compte,
  };
  const proportionRouge = compteRouge / compte;
  const proportionNonRouge = (compte - compteRouge) / compte;
  return {
    moyenne,
    proportionRouge,
    proportionNonRouge,
    type: classifierDepuisProportions({
      proportionRouge,
      proportionNonRouge,
      moyenne,
    }),
  };
}

/** Compat ancienne API : sans proportions → jamais séparateur strict. */
export function classifierCouleurMoyenne(
  couleur: CouleurMoyenneRgb
): TypePagePdf {
  return classifierDepuisProportions({
    proportionRouge: 0,
    proportionNonRouge: 1,
    moyenne: couleur,
  });
}

export function moyenneRgbDepuisPixels(
  data: Uint8ClampedArray | Uint8Array,
  _pas = PAS_ECHANTILLONNAGE_PIXELS
): CouleurMoyenneRgb {
  return analyserPixelsPage(data).moyenne;
}

/**
 * Segments à conserver.
 * - rouge : coupe + page ignorée
 * - blanc / contenu / douteux : conservés
 */
export function detecterSegmentsParTypes(
  types: readonly TypePagePdf[]
): number[][] {
  const segments: number[][] = [];
  let courant: number[] = [];

  for (let index = 0; index < types.length; index += 1) {
    if (types[index] === "rouge") {
      if (courant.length > 0) {
        segments.push(courant);
        courant = [];
      }
      continue;
    }
    courant.push(index);
  }

  if (courant.length > 0) {
    segments.push(courant);
  }

  return segments;
}

export function verifierIntegriteDecoupage(params: {
  nombrePagesOrigine: number;
  segments: readonly (readonly number[])[];
  types: readonly TypePagePdf[];
}): boolean {
  const pagesSegments = params.segments.reduce(
    (total, segment) => total + segment.length,
    0
  );
  const pagesRouges = params.types.filter((type) => type === "rouge").length;
  return pagesSegments + pagesRouges === params.nombrePagesOrigine;
}

export function tropDePagesSepareurs(types: readonly TypePagePdf[]): boolean {
  if (types.length === 0) {
    return false;
  }
  const nbRouge = types.filter((type) => type === "rouge").length;
  return nbRouge / types.length > 0.5;
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

function decoderJpegEnRgba(
  candidate: ImageXObjectCandidate
): Uint8Array | null {
  if (candidate.colorSpace === "DeviceCMYK") {
    return null;
  }

  try {
    const decoded = jpegJs.decode(Buffer.from(candidate.stream.contents), {
      useTArray: true,
      formatAsRGBA: true,
    });
    if (!decoded.data || decoded.data.length === 0) {
      return null;
    }
    return decoded.data instanceof Uint8Array
      ? decoded.data
      : new Uint8Array(decoded.data);
  } catch {
    return null;
  }
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
 * Pixels RGBA de l'image dominante.
 * JPEG → jpeg-js plein ; Flate → pixels bruts.
 * null → le caller traite en « contenu ».
 */
function pixelsDepuisImage(
  candidate: ImageXObjectCandidate
): Uint8Array | null {
  const filters = candidate.filters;

  if (filters.includes("DCTDecode") || filters.includes("DCT")) {
    return decoderJpegEnRgba(candidate);
  }

  if (
    filters.length === 0 ||
    (filters.length === 1 && filters[0] === "FlateDecode")
  ) {
    return decoderFlateEnRgba(candidate);
  }

  return null;
}

async function classifierUnePage(
  page: PDFPage,
  numero: number
): Promise<DiagnosticPagePdf> {
  try {
    const images = imagesDeLaPage(page);
    const dominante = choisirImageDominante(images);

    if (!dominante) {
      console.warn("[split-pdf] page sans image XObject — contenu:", numero);
      return {
        numero,
        type: "contenu",
        moyenne: { r: 0, g: 0, b: 0 },
        proportionRouge: 0,
        proportionNonRouge: 1,
        renduOk: false,
        message: "sans image XObject",
      };
    }

    const rgba = pixelsDepuisImage(dominante);
    if (!rgba) {
      console.warn(
        "[split-pdf] page image non décodable — contenu:",
        numero,
        dominante.filters.join("|") || "none",
        dominante.colorSpace ?? "?"
      );
      return {
        numero,
        type: "contenu",
        moyenne: { r: 0, g: 0, b: 0 },
        proportionRouge: 0,
        proportionNonRouge: 1,
        renduOk: false,
        message: "image non décodable",
      };
    }

    const analyse = analyserPixelsPage(rgba);
    console.log(
      "[split-pdf] page",
      numero,
      "type=",
      analyse.type,
      "rouge%=",
      (analyse.proportionRouge * 100).toFixed(1),
      "nonRouge%=",
      (analyse.proportionNonRouge * 100).toFixed(1),
      "rgb=",
      analyse.moyenne.r.toFixed(1),
      analyse.moyenne.g.toFixed(1),
      analyse.moyenne.b.toFixed(1)
    );

    return {
      numero,
      type: analyse.type,
      moyenne: analyse.moyenne,
      proportionRouge: analyse.proportionRouge,
      proportionNonRouge: analyse.proportionNonRouge,
      renduOk: true,
    };
  } catch (error) {
    console.warn(
      "[split-pdf] page erreur classification — contenu:",
      numero,
      error instanceof Error ? error.message : error
    );
    return {
      numero,
      type: "contenu",
      moyenne: { r: 0, g: 0, b: 0 },
      proportionRouge: 0,
      proportionNonRouge: 1,
      renduOk: false,
      message: error instanceof Error ? error.message : "erreur",
    };
  }
}

/**
 * Classifie chaque page via l'image XObject dominante (scan typique = 1 JPEG pleine page).
 * Jamais d'exception remontée page par page : échec → « contenu ».
 */
export async function classifierPagesParImages(
  pdfBytes: Uint8Array
): Promise<DiagnosticPagePdf[]> {
  const doc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const pages = doc.getPages();
  const diagnostics: DiagnosticPagePdf[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    diagnostics.push(await classifierUnePage(pages[index]!, index + 1));
  }

  const types = diagnostics.map((d) => d.type);
  console.log(
    "[split-pdf] résumé pages:",
    pages.length,
    "blanc=",
    types.filter((t) => t === "blanc").length,
    "rouge=",
    types.filter((t) => t === "rouge").length,
    "douteux=",
    types.filter((t) => t === "douteux").length,
    "contenu=",
    types.filter((t) => t === "contenu").length
  );

  return diagnostics;
}

function pagesParType(
  diagnostics: readonly DiagnosticPagePdf[],
  type: TypePagePdf
): number[] {
  return diagnostics
    .filter((page) => page.type === type)
    .map((page) => page.numero);
}

function resultatOriginalIntact(
  pdfBytes: Uint8Array,
  nomOriginal: string,
  diagnostics: DiagnosticPagePdf[],
  anomalie: string | null = null
): ResultatDecoupagePdf {
  return {
    segments: [{ bytes: pdfBytes, nom: nomOriginal }],
    anomalie,
    archiveOriginaleRequise: false,
    diagnostics,
    pagesSepareurs: pagesParType(diagnostics, "rouge"),
    pagesDouteuses: pagesParType(diagnostics, "douteux"),
  };
}

/**
 * Découpe un PDF aux feuilles séparatrices rouges strictes.
 * Blanc / douteux / contenu toujours conservés.
 */
export async function decouperPdfAuxPagesBlanches(
  pdfBytes: Uint8Array,
  nomOriginal: string
): Promise<ResultatDecoupagePdf> {
  const source = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const nombrePages = source.getPageCount();

  if (nombrePages === 0) {
    return resultatOriginalIntact(pdfBytes, nomOriginal, []);
  }

  let diagnostics: DiagnosticPagePdf[];
  try {
    diagnostics = await classifierPagesParImages(pdfBytes);
  } catch (error) {
    console.error(
      "[split-pdf] Échec de la classification — conservation du PDF intact.",
      error
    );
    return resultatOriginalIntact(pdfBytes, nomOriginal, []);
  }

  const types = diagnostics.map((d) => d.type);

  if (types.length !== nombrePages) {
    console.error(
      "[split-pdf] Nombre de pages classifiées incohérent — PDF intact."
    );
    return resultatOriginalIntact(
      pdfBytes,
      nomOriginal,
      diagnostics,
      MESSAGE_ANOMALIE_DECOUPAGE_PDF
    );
  }

  if (tropDePagesSepareurs(types)) {
    return resultatOriginalIntact(
      pdfBytes,
      nomOriginal,
      diagnostics,
      MESSAGE_ANOMALIE_TROP_DE_SEPARATEURS
    );
  }

  if (!types.some((type) => type === "rouge")) {
    return resultatOriginalIntact(pdfBytes, nomOriginal, diagnostics);
  }

  const segments = detecterSegmentsParTypes(types);

  if (
    !verifierIntegriteDecoupage({
      nombrePagesOrigine: nombrePages,
      segments,
      types,
    })
  ) {
    return resultatOriginalIntact(
      pdfBytes,
      nomOriginal,
      diagnostics,
      MESSAGE_ANOMALIE_DECOUPAGE_PDF
    );
  }

  if (segments.length === 0) {
    return resultatOriginalIntact(pdfBytes, nomOriginal, diagnostics);
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
      return resultatOriginalIntact(
        pdfBytes,
        nomOriginal,
        diagnostics,
        MESSAGE_ANOMALIE_DECOUPAGE_PDF
      );
    }
  }

  return {
    segments: resultats,
    anomalie: null,
    archiveOriginaleRequise: resultats.length > 1,
    diagnostics,
    pagesSepareurs: pagesParType(diagnostics, "rouge"),
    pagesDouteuses: pagesParType(diagnostics, "douteux"),
  };
}
