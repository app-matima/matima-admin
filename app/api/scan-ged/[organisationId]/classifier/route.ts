import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { enregistrerDocumentsInboxDepuisStoragePaths } from "@/lib/documents/non-classes-server";
import { normaliserContenuSha256 } from "@/lib/documents/scan-ged-empreintes";
import { requireScanGedOrganisationAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

interface ClassifierBody {
  storagePaths?: string[];
  /** Empreintes indexées par storage_path (hash client, validé serveur). */
  empreintesParStoragePath?: Record<string, string | null | undefined>;
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
  const { organisationId } = await params;
  const acces = await requireScanGedOrganisationAccess(organisationId);
  if (!acces.ok) {
    return NextResponse.json(
      { error: acces.error },
      { status: acces.status },
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

  const empreintesParStoragePath: Record<string, string | null> = {};
  const brut = body.empreintesParStoragePath ?? {};
  for (const path of storagePaths) {
    empreintesParStoragePath[path] = normaliserContenuSha256(brut[path]);
  }

  const { documents, erreurs } =
    await enregistrerDocumentsInboxDepuisStoragePaths({
      storagePaths,
      organisationId,
      scanAdminUserId: acces.admin.id,
      empreintesParStoragePath,
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
