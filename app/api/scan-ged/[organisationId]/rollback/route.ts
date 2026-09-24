import { NextResponse } from "next/server";
import { rollbackStoragePathsInbox } from "@/lib/documents/non-classes-server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

interface RollbackBody {
  storagePaths?: string[];
}

/**
 * POST /api/scan-ged/[organisationId]/rollback
 * Supprime des objets inbox orphelins après échec d'upload/classification.
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

  let body: RollbackBody;
  try {
    body = (await request.json()) as RollbackBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const storagePaths = (body.storagePaths ?? []).filter(
    (path): path is string => typeof path === "string" && path.trim().length > 0,
  );

  try {
    await rollbackStoragePathsInbox(storagePaths, organisationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Échec du rollback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
