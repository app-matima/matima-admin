import { createAdminClient } from "@/lib/supabase/server";
import type { AdminUser } from "@/types/admin";

export async function getAdminUsers(): Promise<AdminUser[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("admin_users")
    .select("id, nom, prenom, email, role, actif")
    .order("nom", { ascending: true });

  if (error) {
    console.error("getAdminUsers", error);
    return [];
  }

  return (data ?? []) as AdminUser[];
}
