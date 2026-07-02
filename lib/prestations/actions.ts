"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";
import type { StatutPrestation } from "@/types";

export async function acceptPrestation(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "prestataire") {
    return { success: false, error: "Action non autorisée." };
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("prestations_commandes")
    .select("prestataire_id, statut")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("acceptPrestation fetch", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!existing) {
    return { success: false, error: "Prestation introuvable." };
  }

  if (existing.prestataire_id) {
    return { success: false, error: "Cette prestation est déjà assignée." };
  }

  if (existing.statut !== "en_attente") {
    return {
      success: false,
      error: "Seules les prestations en attente peuvent être acceptées.",
    };
  }

  const { error } = await supabase
    .from("prestations_commandes")
    .update({
      prestataire_id: currentUser.id,
      statut: "confirme",
    })
    .eq("id", id)
    .is("prestataire_id", null)
    .eq("statut", "en_attente");

  if (error) {
    console.error("acceptPrestation", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/prestations");
  revalidatePath("/planning");
  revalidatePath("/dashboard");

  return { success: true };
}

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
