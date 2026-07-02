import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

interface DeleteAdminUserBody {
  userId?: string;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  let body: DeleteAdminUserBody;

  try {
    body = (await request.json()) as DeleteAdminUserBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const userId = body.userId?.trim();

  if (!userId) {
    return NextResponse.json({ error: "userId est requis." }, { status: 400 });
  }

  if (userId === currentUser.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { error: deleteRowError } = await supabase
    .from("admin_users")
    .delete()
    .eq("id", userId);

  if (deleteRowError) {
    console.error("delete-admin-user admin_users", deleteRowError);
    return NextResponse.json({ error: deleteRowError.message }, { status: 500 });
  }

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    console.error("delete-admin-user auth", deleteAuthError);
    return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
  }

  revalidatePath("/parametres");

  return NextResponse.json({ success: true });
}
