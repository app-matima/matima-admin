import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";

interface AttestationPdfInput {
  majeurNom: string;
  majeurPrenom: string;
  description: string;
  dateRealisation: string;
  heureRealisation: string;
  signatureDataUrl: string;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const GRAY: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [15, 25, 35];
const LIGHT_BG: [number, number, number] = [244, 245, 247];
const LINE_COLOR: [number, number, number] = [229, 231, 235];

function getMatimaLogoBase64(): string {
  const logoPath = path.join(process.cwd(), "public/logo_matima.png");
  const buffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function drawHorizontalLine(doc: jsPDF, y: number): void {
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
}

export function generateAttestationPdf(input: AttestationPdfInput): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;

  const logoData = getMatimaLogoBase64();
  doc.addImage(logoData, "PNG", MARGIN, y - 4, 40, 7.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text("matima.net", PAGE_WIDTH - MARGIN, y + 2, { align: "right" });

  y += 14;
  drawHorizontalLine(doc, y);
  y += 14;

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ATTESTATION DE PRESTATION", PAGE_WIDTH / 2, y, { align: "center" });
  y += 18;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Bénéficiaire", MARGIN, y);
  y += 6;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  const protege = `${input.majeurPrenom} ${input.majeurNom}`.trim();
  doc.text(protege, MARGIN, y);
  y += 16;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Description de la prestation", MARGIN, y);
  y += 5;

  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  const descriptionLines = doc.splitTextToSize(
    input.description,
    CONTENT_WIDTH - 8,
  );
  const boxPadding = 4;
  const lineHeight = 5;
  const boxHeight = descriptionLines.length * lineHeight + boxPadding * 2;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 2, 2, "F");
  doc.text(descriptionLines, MARGIN + boxPadding, y + boxPadding + 4);
  y += boxHeight + 14;

  const columnWidth = CONTENT_WIDTH / 2;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Date de réalisation", MARGIN, y);
  doc.text("Heure de réalisation", MARGIN + columnWidth, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(input.dateRealisation, MARGIN, y);
  doc.text(input.heureRealisation, MARGIN + columnWidth, y);
  y += 16;

  drawHorizontalLine(doc, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Signature du bénéficiaire", MARGIN, y);
  y += 5;

  doc.addImage(input.signatureDataUrl, "PNG", MARGIN, y, 78, 34);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "Document généré par Matima — matima.net",
    PAGE_WIDTH / 2,
    287,
    { align: "center" },
  );

  return doc.output("arraybuffer");
}
