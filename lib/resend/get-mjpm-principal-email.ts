import { createAdminClient } from "@/lib/supabase/server";

interface MjpmPrincipalRow {
  id: string;
  email: string | null;
}

export async function getMjpmPrincipalEmail(
  organisationId: string,
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("utilisateurs")
    .select("id, email")
    .eq("organisation_id", organisationId)
    .eq("est_principal", true)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("getMjpmPrincipalEmail", error);
    }
    return null;
  }

  const mjpm = data as MjpmPrincipalRow;

  if (mjpm.email?.trim()) {
    return mjpm.email.trim();
  }

  const { data: authUser, error: authError } =
    await supabase.auth.admin.getUserById(mjpm.id);

  if (authError || !authUser.user?.email) {
    if (authError) {
      console.error("getMjpmPrincipalEmail auth", authError);
    }
    return null;
  }

  return authUser.user.email;
}
