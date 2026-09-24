/**
 * Découpe un PDF scanné en segments séparés par des feuilles rouges.
 *
 * - Page quasi blanche → retirée, sans démarrer un nouveau document
 * - Page majoritairement rouge → retirée + nouvelle séparation
 * - Autre (contenu) → conservée dans le document en cours
 *
 * Les seuils ci-dessous sont volontairement exposés pour affinage après tests réels.
 */

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

/** Échelle de rendu pdf.js (basse = plus rapide, suffisant pour une moyenne). */
export const ECHELLE_RENDU_PDF = 0.35;

/** N'échantillonner qu'un pixel sur N pour accélérer la moyenne RGB. */
export const PAS_ECHANTILLONNAGE_PIXELS = 4;

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

interface CanvasAndContext {
  canvas: {
    width: number;
    height: number;
  };
  context: {
    fillStyle: string;
    fillRect: (x: number, y: number, w: number, h: number) => void;
    getImageData: (
      x: number,
      y: number,
      w: number,
      h: number
    ) => { data: Uint8ClampedArray };
  };
}

interface PdfCanvasFactory {
  create: (width: number, height: number) => CanvasAndContext;
  destroy: (canvasAndContext: CanvasAndContext) => void;
}

async function classifierPagesParRendu(
  pdfBytes: Uint8Array
): Promise<TypePagePdf[]> {
  // Build legacy requis en Node (polyfills DOMMatrix / canvas via @napi-rs/canvas).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Copie pour éviter le détachement du buffer original (pdf.js transfert parfois).
  const data = pdfBytes.slice();
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const canvasFactory = pdf.canvasFactory as PdfCanvasFactory;
  const types: TypePagePdf[] = [];

  try {
    for (let numero = 1; numero <= pdf.numPages; numero += 1) {
      const page = await pdf.getPage(numero);
      const viewport = page.getViewport({ scale: ECHELLE_RENDU_PDF });
      const canvasAndContext = canvasFactory.create(
        viewport.width,
        viewport.height
      );
      const { canvas, context } = canvasAndContext;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const moyenne = moyenneRgbDepuisPixels(imageData.data);
      types.push(classifierCouleurMoyenne(moyenne));

      canvasFactory.destroy(canvasAndContext);
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

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
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(pdfBytes);
  const nombrePages = source.getPageCount();

  if (nombrePages === 0) {
    return [{ bytes: pdfBytes, nom: nomOriginal }];
  }

  let types: TypePagePdf[];
  try {
    types = await classifierPagesParRendu(pdfBytes);
  } catch (error) {
    console.error(
      "[split-pdf] Échec du rendu couleur — conservation du PDF intact.",
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
  }

  return resultats;
}
