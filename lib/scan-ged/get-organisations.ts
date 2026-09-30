import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import { filtrerDocumentsPourAdmin } from "@/lib/scan-ged/filtrer-documents-admin";
import type { MjpmProfile } from "@/types/clients";
import type { DocumentNonClasse } from "@/types/documents";
import type {
  ScanGedAdminInfo,
  ScanGedOrganisation,
  ScanGedOrganisationContext,
} from "@/types/scan-ged";

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
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return [];
  }

  try {
    const [organisations, mjpmUtilisateurs] = await Promise.all([
      chargerToutesLesLignes<OrganisationRow>(() =>
        supabase
          .from("organisations")
          .select("id, nom")
          .in("id", organisationIds),
      ),
      chargerToutesLesLignes<UtilisateurRow>(() =>
        supabase
          .from("utilisateurs")
          .select("id, organisation_id, role")
          .eq("role", "mjpm"),
      ),
    ]);

    const organisationsTriees = [...organisations].sort((a, b) =>
      a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
    );

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

    return organisationsTriees.map((organisation) => ({
      organisationId: organisation.id,
      cabinetNom: organisation.nom,
      mjpm: mjpmProfiles.get(organisation.id) ?? null,
    }));
  } catch (error) {
    console.error("getScanGedOrganisations", error);
    return [];
  }
}

export async function getScanGedOrganisationContext(
  organisationId: string,
  options: {
    adminUserId: string;
    voirTous?: boolean;
  },
): Promise<ScanGedOrganisationContext> {
  const vide: ScanGedOrganisationContext = {
    dossiers: [],
    majeurs: [],
    documents: [],
    adminCourantId: options.adminUserId,
    scanAdmins: [],
  };

  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (!organisationIds.includes(organisationId)) {
    return vide;
  }

  try {
    const [majeurs, documentsBruts] = await Promise.all([
      chargerToutesLesLignes<{ id: string; nom: string; prenom: string }>(() =>
        supabase
          .from("majeurs")
          .select("id, nom, prenom")
          .eq("organisation_id", organisationId)
          .eq("statut", "actif"),
      ),
      chargerToutesLesLignes<DocumentNonClasse>(() =>
        supabase
          .from("documents")
          .select("*")
          .eq("organisation_id", organisationId)
          .is("majeur_id", null),
      ),
    ]);

    const majeursTries = [...majeurs].sort((a, b) =>
      a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
    );

    const voirTous = Boolean(options.voirTous);
    const documentsFiltres = filtrerDocumentsPourAdmin(
      documentsBruts,
      options.adminUserId,
      voirTous,
    );

    const documentsTries = [...documentsFiltres].sort((a, b) => {
      const dateA = String(a.created_at ?? "");
      const dateB = String(b.created_at ?? "");
      return dateB.localeCompare(dateA);
    });

    const adminIds = [
      ...new Set(
        documentsTries
          .map((document) => document.scan_admin_user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    let scanAdmins: ScanGedAdminInfo[] = [];
    if (adminIds.length > 0) {
      const { data: admins, error: adminsError } = await supabase
        .from("admin_users")
        .select("id, nom, prenom")
        .in("id", adminIds);

      if (adminsError) {
        console.error("getScanGedOrganisationContext admins", adminsError);
      } else {
        scanAdmins = (admins ?? []) as ScanGedAdminInfo[];
      }
    }

    return {
      // Les dossiers GED sont chargés à la demande par protégé (évite la troncature à 1 000).
      dossiers: [],
      majeurs: majeursTries,
      documents: documentsTries,
      adminCourantId: options.adminUserId,
      scanAdmins,
    };
  } catch (error) {
    console.error("getScanGedOrganisationContext", error);
    return vide;
  }
}
