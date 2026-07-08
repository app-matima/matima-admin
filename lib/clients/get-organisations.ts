import { createAdminClient } from "@/lib/supabase/server";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type { Plan } from "@/lib/clients/plans";
import type {
  ClientDetail,
  ClientListItem,
  ClientPrestationItem,
  MjpmProfile,
  ProtegesParStatut,
} from "@/types/clients";

const ORGANISATION_SELECT =
  "id, created_at, plan_id, plans!left(id, nom, prix_par_dossier)";

interface OrganisationRow {
  id: string;
  created_at: string;
  plan_id: string | null;
  plans: PlanRow | PlanRow[] | null;
}

interface PlanRow {
  id: string;
  nom: string;
  prix_par_dossier: number;
}

interface MajeurRow {
  organisation_id: string;
  statut: string;
}

interface UtilisateurRow {
  id: string;
  organisation_id: string;
  role: string;
}

function resolvePlan(
  planId: string | null,
  plans: PlanRow | PlanRow[] | null,
): Plan | null {
  if (!planId || !plans) {
    return null;
  }

  const data = Array.isArray(plans) ? plans[0] : plans;
  if (!data?.id) {
    return null;
  }

  return data;
}

async function enrichMjpmProfile(userId: string): Promise<MjpmProfile> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    console.error("enrichMjpmProfile", userId, error);
  }

  const metadata = data.user?.user_metadata as
    | Record<string, string | undefined>
    | undefined;

  return {
    id: userId,
    nom: metadata?.nom?.trim() || metadata?.last_name?.trim() || "—",
    prenom:
      metadata?.prenom?.trim() || metadata?.first_name?.trim() || "—",
    email: data.user?.email ?? "—",
  };
}

async function enrichMjpmProfiles(
  utilisateurs: UtilisateurRow[],
): Promise<Map<string, MjpmProfile>> {
  const profiles = await Promise.all(
    utilisateurs.map(async (utilisateur) => {
      const profile = await enrichMjpmProfile(utilisateur.id);
      return [utilisateur.organisation_id, profile] as const;
    }),
  );

  return new Map(profiles);
}

function emptyProtegesParStatut(): ProtegesParStatut {
  return { actif: 0, archive: 0, decede: 0 };
}

function incrementProtegeStatut(
  counts: ProtegesParStatut,
  statut: string,
): void {
  if (statut === "actif") counts.actif += 1;
  if (statut === "archive") counts.archive += 1;
  if (statut === "decede") counts.decede += 1;
}

export async function getAllPlans(): Promise<Plan[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("plans")
    .select("id, nom, prix_par_dossier")
    .order("prix_par_dossier", { ascending: true });

  if (error) {
    console.error("getAllPlans", error);
    return [];
  }

  return (data ?? []) as Plan[];
}

export async function getAllClients(): Promise<ClientListItem[]> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return [];
  }

  const [organisationsResult, majeursResult, mjpmResult] = await Promise.all([
    supabase
      .from("organisations")
      .select(ORGANISATION_SELECT)
      .in("id", organisationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("majeurs")
      .select("organisation_id, statut")
      .in("organisation_id", organisationIds),
    supabase
      .from("utilisateurs")
      .select("id, organisation_id, role")
      .in("organisation_id", organisationIds)
      .eq("role", "mjpm"),
  ]);

  if (organisationsResult.error) {
    console.error("getAllClients organisations", organisationsResult.error);
    return [];
  }

  const organisations = (organisationsResult.data ?? []) as OrganisationRow[];
  const majeurs = (majeursResult.data ?? []) as MajeurRow[];
  const mjpmUtilisateurs = (mjpmResult.data ?? []) as UtilisateurRow[];

  const mjpmParOrganisation = new Map<string, UtilisateurRow>();
  for (const utilisateur of mjpmUtilisateurs) {
    if (!mjpmParOrganisation.has(utilisateur.organisation_id)) {
      mjpmParOrganisation.set(utilisateur.organisation_id, utilisateur);
    }
  }

  const mjpmProfiles = await enrichMjpmProfiles(
    Array.from(mjpmParOrganisation.values()),
  );

  const protegesActifsParOrg = new Map<string, number>();
  for (const majeur of majeurs) {
    if (majeur.statut === "actif") {
      protegesActifsParOrg.set(
        majeur.organisation_id,
        (protegesActifsParOrg.get(majeur.organisation_id) ?? 0) + 1,
      );
    }
  }

  return organisations.map((organisation) => {
    const plan = resolvePlan(organisation.plan_id, organisation.plans);

    return {
      organisationId: organisation.id,
      mjpm: mjpmProfiles.get(organisation.id) ?? null,
      created_at: organisation.created_at,
      protegesActifs: protegesActifsParOrg.get(organisation.id) ?? 0,
      plan,
      plan_id: organisation.plan_id,
    };
  });
}

export async function getClientDetail(
  organisationId: string,
): Promise<ClientDetail | null> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();
  if (!organisationIds.includes(organisationId)) {
    return null;
  }

  const [
    organisationResult,
    mjpmResult,
    majeursResult,
    prestationsResult,
  ] = await Promise.all([
    supabase
      .from("organisations")
      .select(ORGANISATION_SELECT)
      .eq("id", organisationId)
      .single(),
    supabase
      .from("utilisateurs")
      .select("id, organisation_id, role")
      .eq("organisation_id", organisationId)
      .eq("role", "mjpm")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("majeurs")
      .select("statut")
      .eq("organisation_id", organisationId),
    supabase
      .from("prestations_commandes")
      .select(
        "id, description, date_souhaitee, statut, majeurs(nom, prenom)",
      )
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (organisationResult.error || !organisationResult.data) {
    console.error("getClientDetail organisation", organisationResult.error);
    return null;
  }

  const organisation = organisationResult.data as OrganisationRow;
  const majeurs = (majeursResult.data ?? []) as { statut: string }[];
  const plan = resolvePlan(organisation.plan_id, organisation.plans);

  const protegesParStatut = emptyProtegesParStatut();
  for (const majeur of majeurs) {
    incrementProtegeStatut(protegesParStatut, majeur.statut);
  }

  let mjpm: MjpmProfile | null = null;
  if (mjpmResult.data) {
    mjpm = await enrichMjpmProfile(mjpmResult.data.id);
  }

  return {
    organisationId: organisation.id,
    mjpm,
    created_at: organisation.created_at,
    plan,
    plan_id: organisation.plan_id,
    dossiersActifs: protegesParStatut.actif,
    protegesParStatut,
    dernieresPrestations:
      (prestationsResult.data as ClientPrestationItem[] | null) ?? [],
  };
}
