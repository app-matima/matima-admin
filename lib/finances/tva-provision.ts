import { createAdminClient } from "@/lib/supabase/server";

async function ensureParametresMatimaRow(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("parametres_matima").upsert(
    { id: 1 },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("ensureParametresMatimaRow", error);
  }
}

export async function getTvaMontantDejaProvisionne(): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("parametres_matima")
    .select("tva_montant_deja_provisionne")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("getTvaMontantDejaProvisionne", error);
    return 0;
  }

  if (!data) {
    await ensureParametresMatimaRow();
    return 0;
  }

  const value = Number(data.tva_montant_deja_provisionne ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function setTvaMontantDejaProvisionne(
  montant: number,
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isFinite(montant) || montant < 0) {
    return {
      success: false,
      error: "Le montant provisionné doit être un nombre positif ou nul.",
    };
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("parametres_matima").upsert(
    {
      id: 1,
      tva_montant_deja_provisionne: montant,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("setTvaMontantDejaProvisionne", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
