import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/types/admin";

interface InviteUserBody {
  email?: string;
  prenom?: string;
  nom?: string;
  role?: string;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  let body: InviteUserBody;

  try {
    body = (await request.json()) as InviteUserBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const prenom = body.prenom?.trim();
  const nom = body.nom?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role?.trim();

  if (!prenom || !nom || !email) {
    return NextResponse.json(
      { error: "email, prenom et nom sont requis." },
      { status: 400 },
    );
  }

  if (role !== "admin" && role !== "prestataire" && role !== "administratif") {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/auth/accept-invite`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      prenom,
      nom,
      role,
    },
    redirectTo,
  });

  if (error) {
    console.error("invite-user", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.user) {
    return NextResponse.json(
      { error: "Invitation créée sans utilisateur." },
      { status: 500 },
    );
  }

  const { error: insertError } = await supabase.from("admin_users").insert({
    id: data.user.id,
    nom,
    prenom,
    email,
    role: role as AdminRole,
    actif: true,
  });

  if (insertError) {
    console.error("invite-user insert admin_users", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  revalidatePath("/parametres");

  return NextResponse.json({ success: true });
}
