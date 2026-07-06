import {
  PDFArray,
  PDFDocument,
  PDFPage,
  PDFStream,
} from "pdf-lib";

const SEUIL_CONTENU_PAGE_BLANCHE = 10;

interface SegmentPages {
  debut: number;
  fin: number;
}

function tailleContenuStream(stream: PDFStream): number {
  return stream.getContentsSize();
}

function tailleContenuPage(page: PDFPage): number {
  const contents = page.node.Contents();

  if (!contents) {
    return 0;
  }

  if (contents instanceof PDFArray) {
    let total = 0;

    for (let index = 0; index < contents.size(); index += 1) {
      const stream = contents.lookup(index, PDFStream);
      total += tailleContenuStream(stream);
    }

    return total;
  }

  if (contents instanceof PDFStream) {
    return tailleContenuStream(contents);
  }

  return 0;
}

function detecterSegments(taillesContenu: number[]): SegmentPages[] {
  const segments: SegmentPages[] = [];
  let debut = 0;

  for (let index = 0; index < taillesContenu.length; index += 1) {
    if (taillesContenu[index] < SEUIL_CONTENU_PAGE_BLANCHE) {
      if (index > debut) {
        segments.push({ debut, fin: index - 1 });
      }
      debut = index + 1;
    }
  }

  if (debut < taillesContenu.length) {
    segments.push({ debut, fin: taillesContenu.length - 1 });
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

export interface SegmentPdf {
  bytes: Uint8Array;
  nom: string;
}

export async function decouperPdfAuxPagesBlanches(
  pdfBytes: Uint8Array,
  nomOriginal: string,
): Promise<SegmentPdf[]> {
  const source = await PDFDocument.load(pdfBytes);
  const taillesContenu = source.getPages().map(tailleContenuPage);
  const segments = detecterSegments(taillesContenu);

  if (segments.length === 0) {
    return [{ bytes: pdfBytes, nom: nomOriginal }];
  }

  const resultats: SegmentPdf[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const cible = await PDFDocument.create();
    const indices = Array.from(
      { length: segment.fin - segment.debut + 1 },
      (_, offset) => segment.debut + offset,
    );
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
