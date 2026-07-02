"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { createAdminClient } from "@/lib/supabase/server";
import type { AdminRole, InviteAdminInput } from "@/types/admin";

export async function inviteAdminUser(
  input: InviteAdminInput,
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser || currentUser.role !== "admin") {
    return { success: false, error: "Action non autorisée." };
  }

  const prenom = input.prenom.trim();
  const nom = input.nom.trim();
  const email = input.email.trim().toLowerCase();

  if (!prenom || !nom || !email) {
    return { success: false, error: "Tous les champs sont obligatoires." };
  }

  if (input.role !== "admin" && input.role !== "prestataire") {
    return { success: false, error: "Rôle invalide." };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      prenom,
      nom,
      role: input.role,
    },
  });

  if (error) {
    console.error("inviteAdminUser", error);
    return { success: false, error: error.message };
  }

  if (!data.user) {
    return { success: false, error: "Invitation créée sans utilisateur." };
  }

  const { error: insertError } = await supabase.from("admin_users").insert({
    id: data.user.id,
    nom,
    prenom,
    email,
    role: input.role as AdminRole,
    actif: true,
  });

  if (insertError) {
    console.error("inviteAdminUser insert admin_users", insertError);
    return {
      success: false,
      error: insertError.message,
    };
  }

  revalidatePath("/parametres");

  return { success: true };
}
