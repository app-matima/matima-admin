import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deplacerEtClasserDocument } from "@/lib/documents/non-classes-server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";
import type { DocumentNonClasse } from "@/types/documents";

export const runtime = "nodejs";

interface ValiderDocumentBody {
  categorieId: string;
  majeurId: string;
  nom: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireScanGedAccess())) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { id } = await params;

  let body: ValiderDocumentBody;

  try {
    body = (await request.json()) as ValiderDocumentBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  if (!body.categorieId || !body.majeurId || !body.nom?.trim()) {
    return NextResponse.json(
      { error: "Catégorie, protégé et nom sont obligatoires." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .is("categorie_id", null)
    .single();

  if (documentError || !document) {
    return NextResponse.json(
      { error: "Document introuvable." },
      { status: 404 },
    );
  }

  try {
    const documentClasse = await deplacerEtClasserDocument({
      document: document as DocumentNonClasse,
      categorieId: body.categorieId,
      majeurId: body.majeurId,
      nom: body.nom,
    });

    revalidatePath("/scan-ged");

    return NextResponse.json(documentClasse);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur lors de la validation du document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
