import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { classerDocumentsInboxDepuisStoragePaths } from "@/lib/documents/non-classes-server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

interface ClassifierBody {
  storagePaths?: string[];
}

/**
 * POST /api/scan-ged/[organisationId]/classifier
 * Classifie des fichiers déjà présents en inbox Storage (payload JSON léger).
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

  const supabase = createAdminClient();
  const [dossiersResult, majeursResult] = await Promise.all([
    supabase
      .from("ged_dossiers")
      .select("id, nom, majeur_id, parent_id")
      .eq("organisation_id", organisationId)
      .order("nom", { ascending: true }),
    supabase
      .from("majeurs")
      .select("id, nom, prenom")
      .eq("organisation_id", organisationId)
      .eq("statut", "actif")
      .order("nom", { ascending: true }),
  ]);

  if (dossiersResult.error) {
    return NextResponse.json(
      { error: dossiersResult.error.message },
      { status: 500 },
    );
  }

  if (majeursResult.error) {
    return NextResponse.json(
      { error: majeursResult.error.message },
      { status: 500 },
    );
  }

  const { documents, erreurs } = await classerDocumentsInboxDepuisStoragePaths({
    storagePaths,
    organisationId,
    dossiers: dossiersResult.data ?? [],
    majeurs: majeursResult.data ?? [],
  });

  if (documents.length === 0) {
    return NextResponse.json(
      { error: erreurs.join(" ") || "Classification impossible." },
      { status: 400 },
    );
  }

  revalidatePath("/scan-ged");

  return NextResponse.json({
    documents,
    erreurs: erreurs.length > 0 ? erreurs : undefined,
  });
}
