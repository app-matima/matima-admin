import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  TAILLE_LOT_CLASSEMENT_DEFAUT,
} from "@/lib/documents/scan-ged-file-attente";
import { traiterLotClassementScanGed } from "@/lib/documents/non-classes-server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

interface TraiterLotBody {
  taille?: number;
  documentIds?: string[];
}

/**
 * POST /api/scan-ged/[organisationId]/traiter-lot
 * Traite N documents en_attente_classement (défaut 5), isolément.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ organisationId: string }> },
) {
  if (!(await requireScanGedAccess())) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { organisationId } = await params;

  if (!organisationId) {
    return NextResponse.json(
      { error: "Organisation requise." },
      { status: 400 },
    );
  }

  const organisationIds = await getNonDemoOrganisationIds();
  if (!organisationIds.includes(organisationId)) {
    return NextResponse.json(
      { error: "Organisation introuvable." },
      { status: 404 },
    );
  }

  let body: TraiterLotBody = {};
  try {
    const texte = await request.text();
    if (texte.trim()) {
      body = JSON.parse(texte) as TraiterLotBody;
    }
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const tailleBrute =
    typeof body.taille === "number" && Number.isFinite(body.taille)
      ? Math.floor(body.taille)
      : TAILLE_LOT_CLASSEMENT_DEFAUT;

  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : undefined;

  try {
    const resultat = await traiterLotClassementScanGed({
      organisationId,
      taille: tailleBrute,
      documentIds,
    });

    revalidatePath("/scan-ged");

    return NextResponse.json(resultat);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de traiter le lot.",
      },
      { status: 500 },
    );
  }
}
