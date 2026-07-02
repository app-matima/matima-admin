import { createAdminClient } from "@/lib/supabase/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import type { AdminUser } from "@/types/admin";

export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  const authClient = await createAuthServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return null;
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("admin_users")
    .select("id, nom, prenom, email, role, actif")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getCurrentAdminUser", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return data as AdminUser;
}
