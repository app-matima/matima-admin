import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { enregistrerDocumentsInboxDepuisStoragePaths } from "@/lib/documents/non-classes-server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

interface ClassifierBody {
  storagePaths?: string[];
}

/**
 * POST /api/scan-ged/[organisationId]/classifier
 * Découpe (blanc/rouge) + enregistrement en file « en_attente_classement ».
 * Ne lance PAS le classement IA (voir /traiter-lot).
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

  let body: ClassifierBody;
  try {
    body = (await request.json()) as ClassifierBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const storagePaths = (body.storagePaths ?? []).filter(
    (path): path is string => typeof path === "string" && path.trim().length > 0,
  );

  if (storagePaths.length === 0) {
    return NextResponse.json(
      { error: "Aucun storage_path fourni." },
      { status: 400 },
    );
  }

  const { documents, erreurs } =
    await enregistrerDocumentsInboxDepuisStoragePaths({
      storagePaths,
      organisationId,
    });

  if (documents.length === 0) {
    return NextResponse.json(
      { error: erreurs.join(" ") || "Enregistrement impossible." },
      { status: 400 },
    );
  }

  revalidatePath("/scan-ged");

  return NextResponse.json({
    documents,
    erreurs: erreurs.length > 0 ? erreurs : undefined,
  });
}
