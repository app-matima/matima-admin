import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/types/admin";

interface CreateAdminUserBody {
  userId?: string;
  prenom?: string;
  nom?: string;
  email?: string;
  role?: string;
}

export async function POST(request: Request) {
  let body: CreateAdminUserBody;

  try {
    body = (await request.json()) as CreateAdminUserBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const userId = body.userId?.trim();
  const prenom = body.prenom?.trim();
  const nom = body.nom?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role?.trim();

  if (!userId || !prenom || !nom || !email) {
    return NextResponse.json(
      { error: "userId, prenom, nom et email sont requis." },
      { status: 400 },
    );
  }

  if (role !== "admin" && role !== "prestataire") {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_users").insert({
    id: userId,
    prenom,
    nom,
    email,
    role: role as AdminRole,
    actif: true,
  });

  if (error) {
    console.error("create-admin-user", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
