"use server";

import { revalidatePath } from "next/cache";
import {
  getAllPlans,
  getClientDetail,
} from "@/lib/clients/get-organisations";
import { createAdminClient } from "@/lib/supabase/server";
import type { ClientDetail } from "@/types/clients";
import type { Plan } from "@/lib/clients/plans";

export async function fetchClientDetail(
  organisationId: string,
): Promise<ClientDetail | null> {
  return getClientDetail(organisationId);
}

export async function fetchPlans(): Promise<Plan[]> {
  return getAllPlans();
}

export async function updateOrganisationPlan(
  organisationId: string,
  planId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("organisations")
    .update({ plan_id: planId })
    .eq("id", organisationId);

  if (error) {
    console.error("updateOrganisationPlan", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/mjpms");

  return { success: true };
}
