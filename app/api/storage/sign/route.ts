import { NextResponse } from "next/server";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

function isValidStoragePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("..")) {
    return false;
  }

  return /^[\w\-./]+$/.test(path);
}

export async function GET(request: Request) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path")?.trim();

  if (!path || !isValidStoragePath(path)) {
    return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    console.error("storage sign", error);
    return NextResponse.json(
      { error: error?.message ?? "Impossible de générer l'URL signée." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
