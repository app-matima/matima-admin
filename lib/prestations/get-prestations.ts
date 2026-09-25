import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type { PrestationAvecRelations } from "@/types";

const PRESTATION_SELECT =
  "id, organisation_id, majeur_id, description, date_souhaitee, date_acceptee, heure_souhaitee, adresse_intervention, instructions, statut, statut_facturation, pennylane_invoice_id, prestataire_id, attestation_url, devis_storage_path, devis_signe_storage_path, devis_signe_le, created_at, majeurs(nom, prenom), organisations(nom)";

export interface PrestationDetailMobile extends PrestationAvecRelations {
  prestataireNom: string | null;
}

export async function getAllPrestations(): Promise<PrestationAvecRelations[]> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return [];
  }

  try {
    const prestations = await chargerToutesLesLignes<PrestationAvecRelations>(
      () =>
        supabase
          .from("prestations_commandes")
          .select(PRESTATION_SELECT)
          .in("organisation_id", organisationIds),
    );

    return [...prestations].sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
    );
  } catch (error) {
    console.error("getAllPrestations", error);
    return [];
  }
}

export async function getPrestationById(
  id: string,
): Promise<PrestationDetailMobile | null> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("prestations_commandes")
    .select(PRESTATION_SELECT)
    .eq("id", id)
    .in("organisation_id", organisationIds)
    .maybeSingle();

  if (error) {
    console.error("getPrestationById", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const prestation = data as PrestationAvecRelations;
  let prestataireNom: string | null = null;

  if (prestation.prestataire_id) {
    const { data: prestataire, error: prestataireError } = await supabase
      .from("admin_users")
      .select("prenom, nom")
      .eq("id", prestation.prestataire_id)
      .maybeSingle();

    if (prestataireError) {
      console.error("getPrestationById prestataire", prestataireError);
    } else if (prestataire) {
      const nom = `${prestataire.prenom ?? ""} ${prestataire.nom ?? ""}`.trim();
      prestataireNom = nom || null;
    }
  }

  return {
    ...prestation,
    prestataireNom,
  };
}
