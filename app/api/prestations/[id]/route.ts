import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

interface UpdatePrestationBody {
  date_acceptee?: string;
}

export async function PATCH(
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

  let body: UpdatePrestationBody;

  try {
    body = (await request.json()) as UpdatePrestationBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const date_acceptee = body.date_acceptee?.trim();

  if (!date_acceptee) {
    return NextResponse.json(
      { error: "date_acceptee est requise." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("prestations_commandes")
    .update({ date_acceptee })
    .eq("id", id)
    .select(
      "id, organisation_id, majeur_id, description, date_souhaitee, date_acceptee, heure_souhaitee, adresse_intervention, instructions, statut, created_at",
    )
    .single();

  if (error) {
    console.error("prestations PATCH", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/planning");
  revalidatePath("/prestations");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true, prestation: data });
}
