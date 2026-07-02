import { createAdminClient } from "@/lib/supabase/server";
import type {
  ClientDetail,
  ClientListItem,
  ClientPrestationItem,
  MjpmProfile,
  ProtegesParStatut,
} from "@/types/clients";

interface OrganisationRow {
  id: string;
  created_at: string;
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

export async function getAllClients(): Promise<ClientListItem[]> {
  const supabase = createAdminClient();

  const [organisationsResult, majeursResult, mjpmResult] = await Promise.all([
    supabase
      .from("organisations")
      .select("id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("majeurs").select("organisation_id, statut"),
    supabase
      .from("utilisateurs")
      .select("id, organisation_id, role")
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

  return organisations.map((organisation) => ({
    organisationId: organisation.id,
    mjpm: mjpmProfiles.get(organisation.id) ?? null,
    created_at: organisation.created_at,
    protegesActifs: protegesActifsParOrg.get(organisation.id) ?? 0,
  }));
}

export async function getClientDetail(
  organisationId: string,
): Promise<ClientDetail | null> {
  const supabase = createAdminClient();

  const [
    organisationResult,
    mjpmResult,
    majeursResult,
    prestationsResult,
  ] = await Promise.all([
    supabase
      .from("organisations")
      .select("id, created_at")
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
    protegesParStatut,
    dernieresPrestations:
      (prestationsResult.data as ClientPrestationItem[] | null) ?? [],
  };
}
