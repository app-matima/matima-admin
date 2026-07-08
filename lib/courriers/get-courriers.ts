import { createAdminClient } from "@/lib/supabase/server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type { CourrierAvecRelations } from "@/types/courriers";

const COURRIER_SELECT = `
  id,
  majeur_id,
  organisation_id,
  destinataire_nom,
  destinataire_adresse,
  type_envoi,
  nombre_pages,
  prix_facture,
  statut,
  storage_path,
  created_at,
  envoye_at,
  majeurs(nom, prenom),
  organisations(nom)
`;

export async function getCourriers(): Promise<CourrierAvecRelations[]> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("courriers")
    .select(COURRIER_SELECT)
    .in("organisation_id", organisationIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getCourriers", error);
    return [];
  }

  return (data ?? []) as CourrierAvecRelations[];
}
