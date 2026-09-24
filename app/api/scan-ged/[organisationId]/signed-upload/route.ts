import { NextResponse } from "next/server";
import { creerUrlUploadSigneInbox } from "@/lib/documents/non-classes-server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

interface SignedUploadBody {
  nom?: string;
  typeDocument?: string;
}

/**
 * POST /api/scan-ged/[organisationId]/signed-upload
 * Génère une URL d'upload signée vers l'inbox Storage (bypass limite body Vercel).
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

  let body: SignedUploadBody;
  try {
    body = (await request.json()) as SignedUploadBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const nom = typeof body.nom === "string" ? body.nom.trim() : "";
  if (!nom) {
    return NextResponse.json({ error: "Nom de fichier requis." }, { status: 400 });
  }

  try {
    const resultat = await creerUrlUploadSigneInbox({
      organisationId,
      nom,
      typeDocument: body.typeDocument,
    });

    return NextResponse.json(resultat);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de générer l'URL d'upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
