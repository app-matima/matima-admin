import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument, rgb } from "pdf-lib";
import jpegJs from "jpeg-js";

import type { CouleurRgb } from "./jpeg-dc-moyenne";
import {
  analyserPixelsPage,
  classifierPagesParImages,
  decouperPdfAuxPagesBlanches,
  detecterSegmentsParTypes,
  type TypePagePdf,
} from "./split-pdf-blank-pages";

/** Référence tests : analyse pixels pleine résolution (jpeg-js). */
function analyserJpegComplet(jpegBytes: Uint8Array): {
  type: TypePagePdf;
  moyenne: CouleurRgb;
} | null {
  try {
    const decoded = jpegJs.decode(Buffer.from(jpegBytes), {
      useTArray: true,
      formatAsRGBA: true,
    });
    if (!decoded.data || decoded.data.length === 0) {
      return null;
    }
    const pixels =
      decoded.data instanceof Uint8Array
        ? decoded.data
        : new Uint8Array(decoded.data);
    const analyse = analyserPixelsPage(pixels);
    return { type: analyse.type, moyenne: analyse.moyenne };
  } catch {
    return null;
  }
}

function creerJpegUniCouleur(
  r: number,
  g: number,
  b: number,
  width = 64,
  height = 64
): Uint8Array {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  const encoded = jpegJs.encode({ data, width, height }, 95);
  return new Uint8Array(encoded.data);
}

/** JPEG « contenu » avec motif pour éviter une moyenne unie trompeuse. */
function creerJpegMotifContenu(width = 256, height = 256): Uint8Array {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      // Texte / document simulé : fond clair + zones sombres
      const zoneTexte = x % 40 < 8 || y % 30 < 3;
      data[o] = zoneTexte ? 30 : 245;
      data[o + 1] = zoneTexte ? 30 : 245;
      data[o + 2] = zoneTexte ? 30 : 245;
      data[o + 3] = 255;
    }
  }
  const encoded = jpegJs.encode({ data, width, height }, 90);
  return new Uint8Array(encoded.data);
}

async function pdfAvecImagesJpeg(
  couleurs: Array<{ r: number; g: number; b: number } | "vectoriel">
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const couleur of couleurs) {
    const page = doc.addPage([200, 200]);
    if (couleur === "vectoriel") {
      page.drawRectangle({
        x: 20,
        y: 20,
        width: 160,
        height: 160,
        color: rgb(0.1, 0.4, 0.8),
      });
      continue;
    }

    const jpeg = creerJpegUniCouleur(couleur.r, couleur.g, couleur.b);
    const image = await doc.embedJpg(jpeg);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
  }

  return doc.save();
}

describe("analyserPixelsPage (JPEG)", () => {
  it("détecte feuille blanche / rouge / contenu", () => {
    assert.equal(
      analyserJpegComplet(creerJpegUniCouleur(255, 255, 255))?.type,
      "blanc"
    );
    assert.equal(
      analyserJpegComplet(creerJpegUniCouleur(220, 20, 20))?.type,
      "rouge"
    );
    assert.equal(analyserJpegComplet(creerJpegMotifContenu())?.type, "contenu");
  });
});

describe("detecterSegmentsParTypes", () => {
  it("coupe sur les pages rouges et conserve le blanc", () => {
    assert.deepEqual(
      detecterSegmentsParTypes([
        "contenu",
        "blanc",
        "rouge",
        "contenu",
        "contenu",
      ]),
      [
        [0, 1],
        [3, 4],
      ]
    );
  });
});

describe("classifierPagesParImages", () => {
  it("classifie blanc / rouge / contenu depuis des JPEG embarqués", async () => {
    const pdf = await pdfAvecImagesJpeg([
      { r: 255, g: 255, b: 255 },
      { r: 220, g: 20, b: 20 },
      { r: 40, g: 80, b: 160 },
    ]);

    const diagnostics = await classifierPagesParImages(pdf);
    assert.deepEqual(
      diagnostics.map((d) => d.type),
      ["blanc", "rouge", "contenu"]
    );
  });

  it("traite une page vectorielle sans image comme contenu", async () => {
    const pdf = await pdfAvecImagesJpeg(["vectoriel"]);
    const diagnostics = await classifierPagesParImages(pdf);
    assert.deepEqual(
      diagnostics.map((d) => d.type),
      ["contenu"]
    );
  });

  it("ne fait pas planter le lot si une page est vectorielle au milieu", async () => {
    const pdf = await pdfAvecImagesJpeg([
      { r: 30, g: 30, b: 30 },
      "vectoriel",
      { r: 220, g: 15, b: 15 },
      { r: 50, g: 50, b: 50 },
    ]);

    const diagnostics = await classifierPagesParImages(pdf);
    assert.deepEqual(
      diagnostics.map((d) => d.type),
      ["contenu", "contenu", "rouge", "contenu"]
    );
  });
});

describe("decouperPdfAuxPagesBlanches", () => {
  it("découpe aux séparateurs rouges et conserve les blancs", async () => {
    const pdf = await pdfAvecImagesJpeg([
      { r: 20, g: 20, b: 20 },
      { r: 255, g: 255, b: 255 },
      { r: 220, g: 20, b: 20 },
      { r: 40, g: 40, b: 40 },
      { r: 60, g: 60, b: 60 },
    ]);

    const resultat = await decouperPdfAuxPagesBlanches(pdf, "scan.pdf");
    assert.equal(resultat.segments.length, 2);
    assert.equal(resultat.segments[0]?.nom, "scan_partie1.pdf");
    assert.equal(resultat.segments[1]?.nom, "scan_partie2.pdf");
    assert.equal(resultat.archiveOriginaleRequise, true);

    const doc1 = await PDFDocument.load(resultat.segments[0]!.bytes);
    const doc2 = await PDFDocument.load(resultat.segments[1]!.bytes);
    assert.equal(doc1.getPageCount(), 2); // contenu + blanc
    assert.equal(doc2.getPageCount(), 2);
  });

  it("conserve le PDF intact si aucune coupure utile", async () => {
    const pdf = await pdfAvecImagesJpeg([
      { r: 40, g: 80, b: 120 },
      { r: 50, g: 90, b: 130 },
    ]);

    const resultat = await decouperPdfAuxPagesBlanches(pdf, "doc.pdf");
    assert.equal(resultat.segments.length, 1);
    assert.equal(resultat.segments[0]?.nom, "doc.pdf");
    assert.equal(resultat.archiveOriginaleRequise, false);
  });
});
