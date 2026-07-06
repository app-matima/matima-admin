import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { traiterFichiersNonClasse } from "@/lib/documents/non-classes-server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

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

  const supabase = createAdminClient();

  const [categoriesResult, majeursResult] = await Promise.all([
    supabase
      .from("categories_documents")
      .select("id, nom")
      .eq("organisation_id", organisationId)
      .order("nom", { ascending: true }),
    supabase
      .from("majeurs")
      .select("id, nom, prenom")
      .eq("organisation_id", organisationId)
      .eq("statut", "actif")
      .order("nom", { ascending: true }),
  ]);

  if (categoriesResult.error) {
    return NextResponse.json(
      { error: categoriesResult.error.message },
      { status: 500 },
    );
  }

  if (majeursResult.error) {
    return NextResponse.json(
      { error: majeursResult.error.message },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const fichiers = formData
    .getAll("fichiers")
    .filter((entree): entree is File => entree instanceof File);

  if (fichiers.length === 0) {
    return NextResponse.json(
      { error: "Aucun fichier fourni." },
      { status: 400 },
    );
  }

  const { documents: documentsCrees, erreurs } = await traiterFichiersNonClasse({
    fichiers,
    organisationId,
    categories: categoriesResult.data ?? [],
    majeurs: majeursResult.data ?? [],
  });

  if (documentsCrees.length === 0) {
    return NextResponse.json(
      { error: erreurs.join(" ") || "Import impossible." },
      { status: 400 },
    );
  }

  revalidatePath("/scan-ged");

  return NextResponse.json({
    documents: documentsCrees,
    erreurs: erreurs.length > 0 ? erreurs : undefined,
  });
}
