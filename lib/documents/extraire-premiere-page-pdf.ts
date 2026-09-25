import { PDFDocument } from "pdf-lib";

/**
 * Extrait la première page d'un PDF en un nouveau PDF minimal (pour l'appel A).
 * En cas d'échec ou PDF vide → null (le caller traitera le document entier ou abandonnera).
 */
export async function extrairePremierePagePdf(
  pdfBytes: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    const source = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    if (source.getPageCount() === 0) {
      return null;
    }

    const cible = await PDFDocument.create();
    const [page] = await cible.copyPages(source, [0]);
    cible.addPage(page);
    return await cible.save();
  } catch {
    return null;
  }
}
