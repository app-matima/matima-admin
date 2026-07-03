"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import type { StatutCle } from "@/types/cles";
import { statutsCle } from "@/lib/cles/utils";

async function requireAdmin() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "admin") {
    return null;
  }

  return currentUser;
}

export async function updateCleStatut(
  cleId: string,
  statut: StatutCle,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { success: false, error: "Action non autorisée." };
  }

  if (!statutsCle.includes(statut)) {
    return { success: false, error: "Statut invalide." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cles")
    .update({ statut })
    .eq("id", cleId);

  if (error) {
    console.error("updateCleStatut", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/cles");

  return { success: true };
}

export async function updateCleNotes(
  cleId: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) {
    return { success: false, error: "Action non autorisée." };
  }

  const supabase = createAdminClient();
  const trimmed = notes.trim();

  const { error } = await supabase
    .from("cles")
    .update({ notes: trimmed || null })
    .eq("id", cleId);

  if (error) {
    console.error("updateCleNotes", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/cles");

  return { success: true };
}
