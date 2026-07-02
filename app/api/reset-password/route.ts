import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

interface ResetPasswordBody {
  userId?: string;
  password?: string;
}

export async function POST(request: Request) {
  let body: ResetPasswordBody;

  try {
    body = (await request.json()) as ResetPasswordBody;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const password = body.password;

  if (!userId) {
    return NextResponse.json({ error: "userId est requis." }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "password est requis (6 caractères minimum)." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    console.error("reset-password", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
