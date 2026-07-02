import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

interface CreateContactBody {
  nom?: string;
  prenom?: string;
  entreprise?: string;
  telephone?: string;
  email?: string;
  role?: string;
  notes?: string;
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

  let body: CreateContactBody;

  try {
    body = (await request.json()) as CreateContactBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const nom = body.nom?.trim();

  if (!nom) {
    return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contacts_internes")
    .insert({
      nom,
      prenom: normalizeOptional(body.prenom),
      entreprise: normalizeOptional(body.entreprise),
      telephone: normalizeOptional(body.telephone),
      email: normalizeOptional(body.email),
      role: normalizeOptional(body.role),
      notes: normalizeOptional(body.notes),
    })
    .select(
      "id, nom, prenom, entreprise, telephone, email, role, notes, created_at",
    )
    .single();

  if (error) {
    console.error("contacts POST", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/contacts");

  return NextResponse.json({ success: true, contact: data });
}
