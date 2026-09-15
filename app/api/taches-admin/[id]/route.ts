import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
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

  const supabase = createAdminClient();
  const { error } = await supabase.from("taches_admin").delete().eq("id", id);

  if (error) {
    console.error("taches-admin DELETE", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/m/planning");

  return NextResponse.json({ success: true });
}
