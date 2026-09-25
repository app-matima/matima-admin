import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type {
  DashboardData,
  Organisation,
  PrestationAvecRelations,
} from "@/types";

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return {
      metrics: {
        prestationsEnAttente: 0,
        prestationsEnCours: 0,
        clientsActifs: 0,
        protegesTotal: 0,
      },
      dernieresPrestations: [],
      nouveauxClients: [],
    };
  }

  const [
    prestationsEnAttente,
    prestationsEnCours,
    clientsActifs,
    protegesTotal,
    dernieresPrestationsResult,
    nouveauxClientsResult,
  ] = await Promise.all([
    chargerToutesLesLignes<{ id: string }>(() =>
      supabase
        .from("prestations_commandes")
        .select("id")
        .eq("statut", "en_attente")
        .in("organisation_id", organisationIds),
    )
      .then((lignes) => lignes.length)
      .catch((error: unknown) => {
        console.error("prestations en attente", error);
        return 0;
      }),
    chargerToutesLesLignes<{ id: string }>(() =>
      supabase
        .from("prestations_commandes")
        .select("id")
        .in("statut", ["en_cours", "confirme"])
        .in("organisation_id", organisationIds),
    )
      .then((lignes) => lignes.length)
      .catch((error: unknown) => {
        console.error("prestations en cours", error);
        return 0;
      }),
    chargerToutesLesLignes<{ id: string }>(() =>
      supabase.from("organisations").select("id").in("id", organisationIds),
    )
      .then((lignes) => lignes.length)
      .catch((error: unknown) => {
        console.error("organisations", error);
        return 0;
      }),
    chargerToutesLesLignes<{ id: string }>(() =>
      supabase
        .from("majeurs")
        .select("id")
        .in("organisation_id", organisationIds),
    )
      .then((lignes) => lignes.length)
      .catch((error: unknown) => {
        console.error("majeurs", error);
        return 0;
      }),
    supabase
      .from("prestations_commandes")
      .select(
        "id, organisation_id, majeur_id, description, date_souhaitee, statut, created_at, majeurs(nom, prenom), organisations(nom)",
      )
      .in("organisation_id", organisationIds)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("organisations")
      .select("id, nom, created_at")
      .in("id", organisationIds)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    metrics: {
      prestationsEnAttente,
      prestationsEnCours,
      clientsActifs,
      protegesTotal,
    },
    dernieresPrestations:
      (dernieresPrestationsResult.data as PrestationAvecRelations[] | null) ??
      [],
    nouveauxClients:
      (nouveauxClientsResult.data as Organisation[] | null) ?? [],
  };
}
