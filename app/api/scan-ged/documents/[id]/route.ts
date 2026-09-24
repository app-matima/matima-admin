import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";

export const runtime = "nodejs";

const BUCKET = "documents";

/**
 * DELETE /api/scan-ged/documents/[id]
 * Supprime un document encore non classé (majeur_id null) + son fichier Storage.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireScanGedAccess())) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Document requis." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: document, error: lectureError } = await supabase
    .from("documents")
    .select("id, storage_path, organisation_id")
    .eq("id", id)
    .is("majeur_id", null)
    .maybeSingle();

  if (lectureError) {
    return NextResponse.json({ error: lectureError.message }, { status: 500 });
  }

  if (!document) {
    return NextResponse.json(
      {
        error:
          "Document introuvable ou déjà classé — suppression impossible.",
      },
      { status: 404 },
    );
  }

  if (document.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([document.storage_path]);

    if (storageError) {
      return NextResponse.json(
        { error: storageError.message },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", document.id)
    .is("majeur_id", null);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  revalidatePath("/scan-ged");

  return NextResponse.json({ ok: true });
}
