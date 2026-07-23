"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { setTvaMontantDejaProvisionne } from "@/lib/finances/tva-provision";

export async function updateTvaMontantDejaProvisionne(
  montant: number,
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "admin") {
    return { success: false, error: "Action non autorisée." };
  }

  const result = await setTvaMontantDejaProvisionne(montant);

  if (!result.success) {
    return result;
  }

  revalidatePath("/finances/tva");
  return { success: true };
}
