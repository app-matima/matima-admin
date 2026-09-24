import { createAdminClient } from "@/lib/supabase/server";

/**
 * Organisations visibles dans l'admin :
 * hors comptes démo (`is_demo`) et hors comptes de test (`est_compte_test`).
 */
export async function getNonDemoOrganisationIds(): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("organisations")
    .select("id")
    .eq("is_demo", false)
    .eq("est_compte_test", false);

  if (error) {
    console.error("getNonDemoOrganisationIds", error);
    return [];
  }

  return (data ?? []).map((organisation) => organisation.id as string);
}
