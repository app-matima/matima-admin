"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { notifyPrestationStatutChange } from "@/lib/prestations/notify-prestation-statut-change";
import {
  getStatutFactureClient,
  mapPennylaneToStatutFacturation,
  rechercherFacturesCorrespondantes,
  type FacturePennylaneSuggestion,
} from "@/lib/pennylane/client";
import { createAdminClient } from "@/lib/supabase/server";
import type { StatutFacturation, StatutPrestation } from "@/types";

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
  const currentUser = await getCurrentAdminUser();
  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("prestations_commandes")
    .select(
      `
      id,
      organisation_id,
      description,
      statut,
      majeurs ( nom, prenom )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("updatePrestationStatut fetch", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!existing) {
    return { success: false, error: "Prestation introuvable." };
  }

  const ancienStatut = existing.statut as StatutPrestation;

  if (ancienStatut === statut) {
    return { success: true };
  }

  const updatePayload: {
    statut: StatutPrestation;
    statut_facturation?: "a_facturer";
  } = { statut };

  if (statut === "realise") {
    updatePayload.statut_facturation = "a_facturer";
  }

  const { error } = await supabase
    .from("prestations_commandes")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("updatePrestationStatut", error);
    return { success: false, error: error.message };
  }

  if (currentUser?.role === "admin") {
    try {
      await notifyPrestationStatutChange({
        organisationId: existing.organisation_id,
        description: existing.description,
        ancienStatut,
        nouveauStatut: statut,
        majeur: existing.majeurs,
      });
    } catch (emailError) {
      console.error("updatePrestationStatut email", emailError);
    }
  }

  revalidatePath("/prestations");
  revalidatePath("/dashboard");
  revalidatePath("/planning");

  return { success: true };
}

export async function setPennylaneInvoiceId(
  id: string,
  pennylaneInvoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentAdminUser();

  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "administratif")
  ) {
    return { success: false, error: "Action non autorisée." };
  }

  const trimmedId = pennylaneInvoiceId.trim();

  if (!trimmedId) {
    return {
      success: false,
      error: "La référence de facture Pennylane est obligatoire.",
    };
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("prestations_commandes")
    .select("id, statut")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("setPennylaneInvoiceId fetch", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!existing) {
    return { success: false, error: "Prestation introuvable." };
  }

  if (existing.statut !== "realise") {
    return {
      success: false,
      error: "Seules les prestations réalisées peuvent être facturées.",
    };
  }

  const { error } = await supabase
    .from("prestations_commandes")
    .update({
      pennylane_invoice_id: trimmedId,
      statut_facturation: "facture_envoyee",
    })
    .eq("id", id);

  if (error) {
    console.error("setPennylaneInvoiceId", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/prestations");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function refreshStatutFacturationPrestation(
  id: string,
): Promise<{
  success: boolean;
  statutFacturation?: StatutFacturation;
  updated?: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentAdminUser();

  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "administratif")
  ) {
    return { success: false, error: "Action non autorisée." };
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("prestations_commandes")
    .select("id, pennylane_invoice_id, statut_facturation")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("refreshStatutFacturationPrestation fetch", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!existing) {
    return { success: false, error: "Prestation introuvable." };
  }

  const invoiceId = existing.pennylane_invoice_id?.trim();

  if (!invoiceId) {
    return {
      success: false,
      error: "Aucune référence Pennylane associée à cette prestation.",
    };
  }

  const statutActuel = (existing.statut_facturation ??
    "a_facturer") as StatutFacturation;

  if (statutActuel === "payee") {
    return {
      success: true,
      statutFacturation: "payee",
      updated: false,
    };
  }

  try {
    const statutPennylane = await getStatutFactureClient(invoiceId);
    const nouveauStatut = mapPennylaneToStatutFacturation(statutPennylane);

    if (nouveauStatut === statutActuel) {
      return {
        success: true,
        statutFacturation: statutActuel,
        updated: false,
      };
    }

    const { error: updateError } = await supabase
      .from("prestations_commandes")
      .update({ statut_facturation: nouveauStatut })
      .eq("id", id);

    if (updateError) {
      console.error("refreshStatutFacturationPrestation update", updateError);
      return { success: false, error: updateError.message };
    }

    revalidatePath("/prestations");
    revalidatePath("/dashboard");

    return {
      success: true,
      statutFacturation: nouveauStatut,
      updated: true,
    };
  } catch (error) {
    console.error("refreshStatutFacturationPrestation", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Impossible de synchroniser le statut Pennylane.",
    };
  }
}

export async function getSuggestionsFacturesPennylane(params: {
  nomClient: string;
  montantApprox?: number | null;
  dateApprox: string;
}): Promise<{
  success: boolean;
  suggestions?: FacturePennylaneSuggestion[];
  error?: string;
}> {
  const currentUser = await getCurrentAdminUser();

  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "administratif")
  ) {
    return { success: false, error: "Action non autorisée." };
  }

  const nomClient = params.nomClient.trim();
  const dateApprox = params.dateApprox.trim();

  if (!nomClient || !dateApprox) {
    return { success: true, suggestions: [] };
  }

  try {
    const suggestions = await rechercherFacturesCorrespondantes(
      nomClient,
      params.montantApprox ?? null,
      dateApprox,
    );

    return { success: true, suggestions };
  } catch (error) {
    console.error("getSuggestionsFacturesPennylane", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Impossible de récupérer les suggestions Pennylane.",
    };
  }
}
