import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";
import type { StatutPrestation } from "@/types";

const MAX_DEVIS_BYTES = 10 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Fichier PDF requis." },
      { status: 400 },
    );
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Seuls les fichiers PDF sont acceptés." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_DEVIS_BYTES) {
    return NextResponse.json(
      { error: "Le devis doit faire au maximum 10 Mo." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: prestation, error: fetchError } = await supabase
    .from("prestations_commandes")
    .select("id, statut, prestataire_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("devis fetch", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!prestation) {
    return NextResponse.json(
      { error: "Prestation introuvable." },
      { status: 404 },
    );
  }

  const statut = prestation.statut as StatutPrestation;

  if (statut === "en_attente") {
    return NextResponse.json(
      {
        error:
          "Impossible de joindre un devis à une prestation en attente.",
      },
      { status: 400 },
    );
  }

  if (
    currentUser.role === "prestataire" &&
    prestation.prestataire_id !== currentUser.id
  ) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const storagePath = `devis/${id}.pdf`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("devis upload", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("prestations_commandes")
    .update({ devis_storage_path: storagePath })
    .eq("id", id);

  if (updateError) {
    console.error("devis update prestation", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath("/prestations");
  revalidatePath("/planning");
  revalidatePath("/dashboard");

  return NextResponse.json({
    success: true,
    devis_storage_path: storagePath,
  });
}
