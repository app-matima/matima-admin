import { NextResponse } from "next/server";
import {
  MAX_HASH_PAR_APPEL_VERIFICATION,
  estContenuSha256Valide,
} from "@/lib/documents/scan-ged-empreintes";
import { rechercherEmpreintesConnuesOrganisation } from "@/lib/documents/scan-ged-empreintes-server";
import { requireScanGedOrganisationAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

interface VerifierEmpreintesBody {
  hashes?: unknown;
}

/**
 * POST /api/scan-ged/[organisationId]/verifier-empreintes
 * Renvoie les hash déjà connus dans l'organisation (file + GED).
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

  let body: VerifierEmpreintesBody;
  try {
    body = (await request.json()) as VerifierEmpreintesBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.hashes)) {
    return NextResponse.json(
      { error: "Requête invalide." },
      { status: 400 },
    );
  }

  if (body.hashes.length > MAX_HASH_PAR_APPEL_VERIFICATION) {
    return NextResponse.json(
      { error: "Trop de fichiers dans une seule vérification." },
      { status: 400 },
    );
  }

  const hashes: string[] = [];
  for (const item of body.hashes) {
    if (typeof item !== "string" || !estContenuSha256Valide(item.trim().toLowerCase())) {
      return NextResponse.json(
        { error: "Requête invalide." },
        { status: 400 },
      );
    }
    hashes.push(item.trim().toLowerCase());
  }

  try {
    const connus = await rechercherEmpreintesConnuesOrganisation({
      organisationId,
      hashes,
    });

    return NextResponse.json({ connus });
  } catch (error) {
    console.error("[verifier-empreintes]", error);
    return NextResponse.json(
      { error: "Impossible de vérifier les fichiers." },
      { status: 500 },
    );
  }
}
