import { NextResponse } from "next/server";
import { TAILLE_LOT_BACKFILL_EMPREINTES } from "@/lib/documents/scan-ged-empreintes";
import { calculerEmpreintesDocumentsScanGedLot } from "@/lib/documents/scan-ged-empreintes-server";
import { requireScanGedOrganisationAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";
/** Marge au-dessus du budget interne ~200 s. */
export const maxDuration = 300;

interface CalculerEmpreintesBody {
  taille?: unknown;
}

/**
 * POST /api/scan-ged/[organisationId]/calculer-empreintes
 * Backfill SHA-256 des documents Scan GED sans empreinte (lots ≤ 50).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organisationId: string }> },
) {
  const { organisationId } = await params;
  const acces = await requireScanGedOrganisationAccess(organisationId);
  if (!acces.ok) {
    return NextResponse.json(
      { error: acces.error },
      { status: acces.status },
    );
  }

  let body: CalculerEmpreintesBody = {};
  try {
    const texte = await request.text();
    if (texte.trim()) {
      body = JSON.parse(texte) as CalculerEmpreintesBody;
    }
  } catch {
    return NextResponse.json(
      { error: "Requête invalide." },
      { status: 400 },
    );
  }

  let taille = TAILLE_LOT_BACKFILL_EMPREINTES;
  if (typeof body.taille === "number" && Number.isFinite(body.taille)) {
    taille = Math.min(
      Math.max(Math.floor(body.taille), 1),
      TAILLE_LOT_BACKFILL_EMPREINTES,
    );
  }

  try {
    const resultat = await calculerEmpreintesDocumentsScanGedLot({
      organisationId,
      taille,
    });

    return NextResponse.json(resultat);
  } catch (error) {
    console.error("[calculer-empreintes]", error);
    return NextResponse.json(
      { error: "Impossible de calculer les empreintes." },
      { status: 500 },
    );
  }
}
