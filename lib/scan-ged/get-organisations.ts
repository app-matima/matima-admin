import { createAdminClient } from "@/lib/supabase/server";
import type { MjpmProfile } from "@/types/clients";
import type { ScanGedOrganisation } from "@/types/scan-ged";

interface OrganisationRow {
  id: string;
  nom: string;
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

export async function getScanGedOrganisations(): Promise<ScanGedOrganisation[]> {
  const supabase = createAdminClient();

  const [organisationsResult, mjpmResult] = await Promise.all([
    supabase.from("organisations").select("id, nom").order("nom", {
      ascending: true,
    }),
    supabase
      .from("utilisateurs")
      .select("id, organisation_id, role")
      .eq("role", "mjpm"),
  ]);

  if (organisationsResult.error) {
    console.error("getScanGedOrganisations", organisationsResult.error);
    return [];
  }

  const organisations = (organisationsResult.data ?? []) as OrganisationRow[];
  const mjpmUtilisateurs = (mjpmResult.data ?? []) as UtilisateurRow[];

  const mjpmParOrganisation = new Map<string, UtilisateurRow>();
  for (const utilisateur of mjpmUtilisateurs) {
    if (!mjpmParOrganisation.has(utilisateur.organisation_id)) {
      mjpmParOrganisation.set(utilisateur.organisation_id, utilisateur);
    }
  }

  const mjpmProfiles = new Map<string, MjpmProfile>();
  await Promise.all(
    Array.from(mjpmParOrganisation.entries()).map(
      async ([orgId, utilisateur]) => {
        const profile = await enrichMjpmProfile(utilisateur.id);
        mjpmProfiles.set(orgId, profile);
      },
    ),
  );

  return organisations.map((organisation) => ({
    organisationId: organisation.id,
    cabinetNom: organisation.nom,
    mjpm: mjpmProfiles.get(organisation.id) ?? null,
  }));
}

export async function getScanGedOrganisationContext(
  organisationId: string,
) {
  const supabase = createAdminClient();

  const [categoriesResult, majeursResult, documentsResult] =
    await Promise.all([
      supabase
        .from("categories_documents")
        .select("id, organisation_id, nom, couleur, created_at")
        .eq("organisation_id", organisationId)
        .order("nom", { ascending: true }),
      supabase
        .from("majeurs")
        .select("id, nom, prenom")
        .eq("organisation_id", organisationId)
        .eq("statut", "actif")
        .order("nom", { ascending: true }),
      supabase
        .from("documents")
        .select("*")
        .eq("organisation_id", organisationId)
        .is("categorie_id", null)
        .order("created_at", { ascending: false }),
    ]);

  if (categoriesResult.error) {
    console.error("getScanGedOrganisationContext categories", categoriesResult.error);
  }

  if (majeursResult.error) {
    console.error("getScanGedOrganisationContext majeurs", majeursResult.error);
  }

  if (documentsResult.error) {
    console.error("getScanGedOrganisationContext documents", documentsResult.error);
  }

  return {
    categories: categoriesResult.data ?? [],
    majeurs: majeursResult.data ?? [],
    documents: documentsResult.data ?? [],
  };
}
