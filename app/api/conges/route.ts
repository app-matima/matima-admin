import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

interface CreateCongeBody {
  titre?: string;
  date_debut?: string;
  date_fin?: string;
  notes?: string;
  admin_user_id?: string;
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  let body: CreateCongeBody;

  try {
    body = (await request.json()) as CreateCongeBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const titre = body.titre?.trim();
  const date_debut = body.date_debut?.trim();
  const date_fin = body.date_fin?.trim();

  if (!titre) {
    return NextResponse.json({ error: "Le titre est obligatoire." }, { status: 400 });
  }

  if (!date_debut || !date_fin) {
    return NextResponse.json(
      { error: "Les dates de début et de fin sont obligatoires." },
      { status: 400 },
    );
  }

  if (date_fin < date_debut) {
    return NextResponse.json(
      { error: "La date de fin doit être postérieure ou égale à la date de début." },
      { status: 400 },
    );
  }

  const admin_user_id = body.admin_user_id?.trim();

  if (!admin_user_id) {
    return NextResponse.json(
      { error: "Le membre de l'équipe est obligatoire." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: member, error: memberError } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", admin_user_id)
    .eq("actif", true)
    .maybeSingle();

  if (memberError) {
    console.error("conges POST member lookup", memberError);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  if (!member) {
    return NextResponse.json(
      { error: "Membre de l'équipe invalide." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("conges")
    .insert({
      admin_user_id,
      titre,
      date_debut,
      date_fin,
      notes: normalizeOptional(body.notes),
    })
    .select("id, admin_user_id, titre, date_debut, date_fin, notes")
    .single();

  if (error) {
    console.error("conges POST", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/planning");

  return NextResponse.json({ success: true, conge: data });
}
