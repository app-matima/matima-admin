import { NextResponse } from "next/server";
import { getScanGedOrganisationContext } from "@/lib/scan-ged/get-organisations";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
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

  const context = await getScanGedOrganisationContext(organisationId);

  return NextResponse.json(context);
}
