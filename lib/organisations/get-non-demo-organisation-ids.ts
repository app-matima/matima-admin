import { createAdminClient } from "@/lib/supabase/server";

export async function getNonDemoOrganisationIds(): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("organisations")
    .select("id")
    .eq("is_demo", false);

  if (error) {
    console.error("getNonDemoOrganisationIds", error);
    return [];
  }

  return (data ?? []).map((organisation) => organisation.id as string);
}
