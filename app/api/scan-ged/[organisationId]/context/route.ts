import { NextResponse } from "next/server";
import { getScanGedOrganisationContext } from "@/lib/scan-ged/get-organisations";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organisationId: string }> },
) {
  const admin = await requireScanGedAccess();
  if (!admin) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { organisationId } = await params;

  if (!organisationId) {
    return NextResponse.json(
      { error: "Organisation requise." },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const voirTous =
    url.searchParams.get("tous") === "1" ||
    url.searchParams.get("tous") === "true";

  const context = await getScanGedOrganisationContext(organisationId, {
    adminUserId: admin.id,
    voirTous,
  });

  return NextResponse.json(context);
}
