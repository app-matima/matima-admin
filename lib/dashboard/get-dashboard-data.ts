import { createAdminClient } from "@/lib/supabase/server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type {
  DashboardData,
  Organisation,
  PrestationAvecRelations,
} from "@/types";

function extractCount(result: { data?: unknown[] | null; error?: unknown }, label: string): number {
  if (result.error) {
    console.error(label, result.error);
    return 0;
  }
  return result.data?.length ?? 0;
}

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
    prestationsEnAttenteResult,
    prestationsEnCoursResult,
    clientsActifsResult,
    protegesTotalResult,
    dernieresPrestationsResult,
    nouveauxClientsResult,
  ] = await Promise.all([
    supabase
      .from("prestations_commandes")
      .select("id")
      .eq("statut", "en_attente")
      .in("organisation_id", organisationIds),
    supabase
      .from("prestations_commandes")
      .select("id")
      .in("statut", ["en_cours", "confirme"])
      .in("organisation_id", organisationIds),
    supabase
      .from("organisations")
      .select("id")
      .in("id", organisationIds),
    supabase
      .from("majeurs")
      .select("id")
      .in("organisation_id", organisationIds),
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
      prestationsEnAttente: extractCount(
        prestationsEnAttenteResult,
        "prestations en attente",
      ),
      prestationsEnCours: extractCount(
        prestationsEnCoursResult,
        "prestations en cours",
      ),
      clientsActifs: extractCount(clientsActifsResult, "organisations"),
      protegesTotal: extractCount(protegesTotalResult, "majeurs"),
    },
    dernieresPrestations:
      (dernieresPrestationsResult.data as PrestationAvecRelations[] | null) ??
      [],
    nouveauxClients:
      (nouveauxClientsResult.data as Organisation[] | null) ?? [],
  };
}
