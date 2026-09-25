import { NextResponse } from "next/server";
import { chargerDossiersProtege } from "@/lib/documents/charger-dossiers-protege";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

/**
 * GET /api/scan-ged/[organisationId]/dossiers?majeurId=…
 * Arborescence GED complète d'un protégé (pagination serveur).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ organisationId: string }> },
) {
  if (!(await requireScanGedAccess())) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { organisationId } = await params;
  const majeurId = new URL(request.url).searchParams.get("majeurId")?.trim();

  if (!organisationId) {
    return NextResponse.json(
      { error: "Organisation requise." },
      { status: 400 },
    );
  }

  if (!majeurId) {
    return NextResponse.json(
      { error: "majeurId requis." },
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

  try {
    const dossiers = await chargerDossiersProtege(majeurId, {
      organisationId,
    });

    return NextResponse.json({ dossiers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les dossiers.",
      },
      { status: 500 },
    );
  }
}
