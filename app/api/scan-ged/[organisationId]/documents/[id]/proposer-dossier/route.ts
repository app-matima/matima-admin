import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { proposerDossierPourMajeur } from "@/lib/documents/non-classes-server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";
import type { DocumentNonClasse } from "@/types/documents";

export const runtime = "nodejs";

const BUCKET = "documents";

interface ProposerDossierBody {
  majeurId?: string;
}

/**
 * POST /api/scan-ged/[organisationId]/documents/[id]/proposer-dossier
 * Appel B seul : propose un dossier après choix manuel du protégé.
 */
export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ organisationId: string; id: string }>;
  },
) {
  if (!(await requireScanGedAccess())) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { organisationId, id } = await params;

  if (!organisationId || !id) {
    return NextResponse.json(
      { error: "Organisation et document requis." },
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

  let body: ProposerDossierBody;
  try {
    body = (await request.json()) as ProposerDossierBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const majeurId =
    typeof body.majeurId === "string" ? body.majeurId.trim() : "";

  if (!majeurId) {
    return NextResponse.json(
      { error: "majeurId requis." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: majeur, error: majeurError } = await supabase
    .from("majeurs")
    .select("id, nom, prenom, organisation_id")
    .eq("id", majeurId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (majeurError) {
    return NextResponse.json({ error: majeurError.message }, { status: 500 });
  }

  if (!majeur) {
    return NextResponse.json(
      { error: "Protégé introuvable." },
      { status: 404 },
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .is("majeur_id", null)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json(
      { error: documentError.message },
      { status: 500 },
    );
  }

  if (!document) {
    return NextResponse.json(
      { error: "Document introuvable." },
      { status: 404 },
    );
  }

  const documentNonClasse = document as DocumentNonClasse;

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(documentNonClasse.storage_path);

  if (downloadError || !blob) {
    return NextResponse.json(
      {
        error:
          downloadError?.message ?? "Impossible de télécharger le document.",
      },
      { status: 500 },
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());

  try {
    const proposition = await proposerDossierPourMajeur({
      nom: documentNonClasse.nom_original,
      typeDocument: documentNonClasse.type_document,
      bytes,
      majeur: {
        id: majeur.id,
        nom: majeur.nom,
        prenom: majeur.prenom,
      },
      organisationId,
    });

    const { data: misAJour, error: updateError } = await supabase
      .from("documents")
      .update({
        proposition_majeur_id: majeur.id,
        proposition_ged_dossier_id: proposition.gedDossierId,
        proposition_nouveau_chemin_dossier: proposition.nouveauCheminDossier,
        proposition_suggestion_dossier_existant:
          proposition.suggestionDossierExistant,
        proposition_nom:
          proposition.nomFichier ?? documentNonClasse.nom_original,
        nom_original:
          proposition.nomFichier ?? documentNonClasse.nom_original,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !misAJour) {
      return NextResponse.json(
        {
          error:
            updateError?.message ?? "Impossible de mettre à jour le document.",
        },
        { status: 500 },
      );
    }

    revalidatePath("/scan-ged");

    return NextResponse.json(misAJour as DocumentNonClasse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de proposer un dossier.",
      },
      { status: 500 },
    );
  }
}
