import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument, rgb } from "pdf-lib";
import jpegJs from "jpeg-js";

import {
  moyenneRgbDepuisJpegDc,
  type CouleurRgb,
} from "./jpeg-dc-moyenne";
import {
  classifierCouleurMoyenne,
  classifierPagesParImages,
  decouperPdfAuxPagesBlanches,
  detecterSegmentsParTypes,
  moyenneRgbDepuisPixels,
  type TypePagePdf,
} from "./split-pdf-blank-pages";

/** Référence tests : décodage pleine résolution (jpeg-js). */
function moyenneRgbDepuisJpegComplet(
  jpegBytes: Uint8Array
): CouleurRgb | null {
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
    return moyenneRgbDepuisPixels(pixels, 4);
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

describe("classifierCouleurMoyenne", () => {
  it("détecte le blanc", () => {
    assert.equal(classifierCouleurMoyenne({ r: 250, g: 251, b: 249 }), "blanc");
  });

  it("détecte le rouge séparateur", () => {
    assert.equal(classifierCouleurMoyenne({ r: 200, g: 40, b: 30 }), "rouge");
  });

  it("classe le reste en contenu", () => {
    assert.equal(classifierCouleurMoyenne({ r: 120, g: 130, b: 140 }), "contenu");
  });
});

describe("moyenneRgbDepuisPixels", () => {
  it("ignore les pixels transparents", () => {
    const data = new Uint8Array([
      255, 0, 0, 0, // transparent
      10, 20, 30, 255,
    ]);
    const moyenne = moyenneRgbDepuisPixels(data, 1);
    assert.deepEqual(moyenne, { r: 10, g: 20, b: 30 });
  });
});

describe("detecterSegmentsParTypes", () => {
  it("coupe sur les pages rouges et ignore le blanc", () => {
    assert.deepEqual(
      detecterSegmentsParTypes(["contenu", "blanc", "rouge", "contenu", "contenu"]),
      [[0], [3, 4]]
    );
  });
});

describe("DC-only vs décodage complet (classification)", () => {
  const cas: Array<{
    nom: string;
    jpeg: () => Uint8Array;
    attendu: TypePagePdf;
  }> = [
    {
      nom: "feuille blanche",
      jpeg: () => creerJpegUniCouleur(255, 255, 255, 512, 512),
      attendu: "blanc",
    },
    {
      nom: "feuille rouge",
      jpeg: () => creerJpegUniCouleur(220, 20, 20, 512, 512),
      attendu: "rouge",
    },
    {
      nom: "document contenu (motif)",
      jpeg: () => creerJpegMotifContenu(512, 512),
      attendu: "contenu",
    },
    {
      nom: "gris foncé contenu",
      jpeg: () => creerJpegUniCouleur(40, 80, 160, 256, 256),
      attendu: "contenu",
    },
  ];

  for (const { nom, jpeg, attendu } of cas) {
    it(`même classe « ${attendu} » pour ${nom}`, async () => {
      const bytes = jpeg();
      const moyenneComplet = moyenneRgbDepuisJpegComplet(bytes);
      const moyenneDc = await moyenneRgbDepuisJpegDc(bytes);

      assert.ok(moyenneComplet, "décodage complet doit réussir");
      assert.ok(moyenneDc, "décodage DC doit réussir");

      const classeComplet = classifierCouleurMoyenne(moyenneComplet);
      const classeDc = classifierCouleurMoyenne(moyenneDc);

      assert.equal(classeComplet, attendu, `référence complet = ${attendu}`);
      assert.equal(
        classeDc,
        classeComplet,
        `DC (${classeDc}) doit égaler complet (${classeComplet})`
      );
    });
  }
});

describe("benchmark JPEG DC vs complet (A4 ~300 DPI)", () => {
  it("rapporte le gain de temps mesuré", async () => {
    // A4 à ~300 DPI
    const width = 2480;
    const height = 3508;
    const jpeg = creerJpegUniCouleur(255, 255, 255, width, height);
    const runs = 3;

    // Warm-up
    moyenneRgbDepuisJpegComplet(jpeg);
    await moyenneRgbDepuisJpegDc(jpeg);

    let msComplet = 0;
    let msDc = 0;

    for (let run = 0; run < runs; run += 1) {
      const t0 = performance.now();
      const m1 = moyenneRgbDepuisJpegComplet(jpeg);
      msComplet += performance.now() - t0;
      assert.ok(m1);

      const t1 = performance.now();
      const m2 = await moyenneRgbDepuisJpegDc(jpeg);
      msDc += performance.now() - t1;
      assert.ok(m2);
    }

    const avgComplet = msComplet / runs;
    const avgDc = msDc / runs;
    const speedup = avgComplet / avgDc;

    console.log(
      "[benchmark] A4 2480×3508 blanc — jpeg-js complet:",
      avgComplet.toFixed(1),
      "ms | jp3g DC 1/8:",
      avgDc.toFixed(1),
      "ms | speedup:",
      `${speedup.toFixed(1)}x`
    );

    // Garde-fou : DC doit être nettement plus rapide (au moins 2×).
    assert.ok(
      speedup >= 2,
      `attendu speedup ≥ 2×, obtenu ${speedup.toFixed(2)}×`
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

    const types = await classifierPagesParImages(pdf);
    assert.deepEqual(types, ["blanc", "rouge", "contenu"]);
  });

  it("traite une page vectorielle sans image comme contenu", async () => {
    const pdf = await pdfAvecImagesJpeg(["vectoriel"]);
    const types = await classifierPagesParImages(pdf);
    assert.deepEqual(types, ["contenu"]);
  });

  it("ne fait pas planter le lot si une page est vectorielle au milieu", async () => {
    const pdf = await pdfAvecImagesJpeg([
      { r: 30, g: 30, b: 30 },
      "vectoriel",
      { r: 220, g: 15, b: 15 },
      { r: 50, g: 50, b: 50 },
    ]);

    const types = await classifierPagesParImages(pdf);
    assert.deepEqual(types, ["contenu", "contenu", "rouge", "contenu"]);
  });
});

describe("decouperPdfAuxPagesBlanches", () => {
  it("découpe aux séparateurs rouges et retire les blancs", async () => {
    const pdf = await pdfAvecImagesJpeg([
      { r: 20, g: 20, b: 20 },
      { r: 255, g: 255, b: 255 },
      { r: 220, g: 20, b: 20 },
      { r: 40, g: 40, b: 40 },
      { r: 60, g: 60, b: 60 },
    ]);

    const segments = await decouperPdfAuxPagesBlanches(pdf, "scan.pdf");
    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.nom, "scan_partie1.pdf");
    assert.equal(segments[1]?.nom, "scan_partie2.pdf");

    const doc1 = await PDFDocument.load(segments[0]!.bytes);
    const doc2 = await PDFDocument.load(segments[1]!.bytes);
    assert.equal(doc1.getPageCount(), 1);
    assert.equal(doc2.getPageCount(), 2);
  });

  it("conserve le PDF intact si aucune coupure utile", async () => {
    const pdf = await pdfAvecImagesJpeg([
      { r: 40, g: 80, b: 120 },
      { r: 50, g: 90, b: 130 },
    ]);

    const segments = await decouperPdfAuxPagesBlanches(pdf, "doc.pdf");
    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.nom, "doc.pdf");
  });
});
