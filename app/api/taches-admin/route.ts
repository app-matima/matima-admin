import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

interface CreateTacheBody {
  titre?: string;
  date?: string;
  notes?: string;
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  let body: CreateTacheBody;

  try {
    body = (await request.json()) as CreateTacheBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const titre = body.titre?.trim();
  const date = body.date?.trim();

  if (!titre) {
    return NextResponse.json({ error: "Le titre est obligatoire." }, { status: 400 });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Une date valide (AAAA-MM-JJ) est obligatoire." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("taches_admin")
    .insert({
      admin_user_id: currentUser.id,
      titre,
      date,
      notes: normalizeOptional(body.notes),
    })
    .select("id, admin_user_id, titre, date, notes, created_at")
    .single();

  if (error) {
    console.error("taches-admin POST", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/m/planning");

  return NextResponse.json({ success: true, tache: data });
}
