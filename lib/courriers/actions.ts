"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";

async function requireCourrierAccess() {
  const currentUser = await getCurrentAdminUser();

  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "administratif")
  ) {
    return null;
  }

  return currentUser;
}

export async function marquerCourrierEnvoye(
  courrierId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireCourrierAccess())) {
    return { success: false, error: "Action non autorisée." };
  }

  if (!courrierId) {
    return { success: false, error: "Identifiant requis." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("courriers")
    .update({
      statut: "envoye",
      envoye_at: new Date().toISOString(),
    })
    .eq("id", courrierId);

  if (error) {
    console.error("marquerCourrierEnvoye", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/courriers");

  return { success: true };
}
