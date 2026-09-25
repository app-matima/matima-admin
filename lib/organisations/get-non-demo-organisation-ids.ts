import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";

/**
 * Organisations visibles dans l'admin :
 * hors comptes démo (`is_demo`) et hors comptes de test (`est_compte_test`).
 */
export async function getNonDemoOrganisationIds(): Promise<string[]> {
  const supabase = createAdminClient();

  try {
    const organisations = await chargerToutesLesLignes<{ id: string }>(() =>
      supabase
        .from("organisations")
        .select("id")
        .eq("is_demo", false)
        .eq("est_compte_test", false),
    );

    return organisations.map((organisation) => organisation.id);
  } catch (error) {
    console.error("getNonDemoOrganisationIds", error);
    return [];
  }
}
