import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

interface UpdateContactBody {
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

async function requireAdmin() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "admin") {
    return null;
  }

  return currentUser;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }

  let body: UpdateContactBody;

  try {
    body = (await request.json()) as UpdateContactBody;
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
    .update({
      nom,
      prenom: normalizeOptional(body.prenom),
      entreprise: normalizeOptional(body.entreprise),
      telephone: normalizeOptional(body.telephone),
      email: normalizeOptional(body.email),
      role: normalizeOptional(body.role),
      notes: normalizeOptional(body.notes),
    })
    .eq("id", id)
    .select(
      "id, nom, prenom, entreprise, telephone, email, role, notes, created_at",
    )
    .single();

  if (error) {
    console.error("contacts PATCH", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/contacts");

  return NextResponse.json({ success: true, contact: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("contacts_internes").delete().eq("id", id);

  if (error) {
    console.error("contacts DELETE", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/contacts");

  return NextResponse.json({ success: true });
}
