import { NextResponse } from "next/server";
import { getAdminUsers } from "@/lib/admin/get-admin-users";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";

export async function GET() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const users = await getAdminUsers();

  return NextResponse.json({ users });
}
