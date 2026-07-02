"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { StatutPrestation } from "@/types";

export async function updatePrestationStatut(
  id: string,
  statut: StatutPrestation,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("prestations_commandes")
    .update({ statut })
    .eq("id", id);

  if (error) {
    console.error("updatePrestationStatut", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/prestations");
  revalidatePath("/dashboard");
  revalidatePath("/planning");

  return { success: true };
}
