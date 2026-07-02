import { jsPDF } from "jspdf";

interface AttestationPdfInput {
  majeurNom: string;
  majeurPrenom: string;
  description: string;
  dateRealisation: string;
  heureRealisation: string;
  signatureDataUrl: string;
}

export function generateAttestationPdf(input: AttestationPdfInput): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Attestation de prestation", margin, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const protege = `${input.majeurPrenom} ${input.majeurNom}`.trim();
  doc.text(`Protégé : ${protege}`, margin, y);
  y += 8;
  doc.text(`Date de réalisation : ${input.dateRealisation}`, margin, y);
  y += 8;
  doc.text(`Heure de réalisation : ${input.heureRealisation}`, margin, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Description de la prestation", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");

  const descriptionLines = doc.splitTextToSize(input.description, 170);
  doc.text(descriptionLines, margin, y);
  y += descriptionLines.length * 6 + 10;

  doc.setFont("helvetica", "bold");
  doc.text("Signature du bénéficiaire", margin, y);
  y += 6;

  doc.addImage(input.signatureDataUrl, "PNG", margin, y, 80, 35);

  return doc.output("arraybuffer");
}
