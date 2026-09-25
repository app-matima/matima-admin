import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import { getNonDemoOrganisationIds } from "@/lib/organisations/get-non-demo-organisation-ids";
import type { MjpmProfile } from "@/types/clients";
import type { CleProtege, OrganisationClesGroupe, StatutCle } from "@/types/cles";

interface MajeurRow {
  id: string;
  organisation_id: string;
  nom: string;
  prenom: string;
}

interface CleRow {
  id: string;
  majeur_id: string;
  statut: StatutCle;
  notes: string | null;
}

interface UtilisateurRow {
  id: string;
  organisation_id: string;
  role: string;
}

const TAILLE_CHUNK_IN = 200;

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

async function chargerClesParMajeurIds(
  majeurIds: string[],
): Promise<CleRow[]> {
  if (majeurIds.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  const resultats: CleRow[] = [];

  for (let index = 0; index < majeurIds.length; index += TAILLE_CHUNK_IN) {
    const chunk = majeurIds.slice(index, index + TAILLE_CHUNK_IN);
    const page = await chargerToutesLesLignes<CleRow>(() =>
      supabase
        .from("cles")
        .select("id, majeur_id, statut, notes")
        .in("majeur_id", chunk),
    );
    resultats.push(...page);
  }

  return resultats;
}

async function ensureClesForMajeurs(majeurIds: string[]): Promise<void> {
  if (majeurIds.length === 0) {
    return;
  }

  const supabase = createAdminClient();
  const existingIds = new Set<string>();

  for (let index = 0; index < majeurIds.length; index += TAILLE_CHUNK_IN) {
    const chunk = majeurIds.slice(index, index + TAILLE_CHUNK_IN);
    try {
      const existants = await chargerToutesLesLignes<{
        id: string;
        majeur_id: string;
      }>(() =>
        supabase.from("cles").select("id, majeur_id").in("majeur_id", chunk),
      );
      for (const row of existants) {
        existingIds.add(row.majeur_id);
      }
    } catch (error) {
      console.error("ensureClesForMajeurs fetch", error);
      return;
    }
  }

  const missingIds = majeurIds.filter((id) => !existingIds.has(id));

  if (missingIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("cles").insert(
    missingIds.map((majeur_id) => ({
      majeur_id,
      statut: "non_possede" as const,
    })),
  );

  if (insertError) {
    console.error("ensureClesForMajeurs insert", insertError);
  }
}

export async function getClesData(): Promise<OrganisationClesGroupe[]> {
  const supabase = createAdminClient();
  const organisationIds = await getNonDemoOrganisationIds();

  if (organisationIds.length === 0) {
    return [];
  }

  let majeurs: MajeurRow[];
  let mjpmUtilisateurs: UtilisateurRow[];

  try {
    [majeurs, mjpmUtilisateurs] = await Promise.all([
      chargerToutesLesLignes<MajeurRow>(() =>
        supabase
          .from("majeurs")
          .select("id, organisation_id, nom, prenom")
          .in("organisation_id", organisationIds),
      ),
      chargerToutesLesLignes<UtilisateurRow>(() =>
        supabase
          .from("utilisateurs")
          .select("id, organisation_id, role")
          .in("organisation_id", organisationIds)
          .eq("role", "mjpm"),
      ),
    ]);
  } catch (error) {
    console.error("getClesData", error);
    return [];
  }

  majeurs = [...majeurs].sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
  );

  const majeurIds = majeurs.map((majeur) => majeur.id);

  await ensureClesForMajeurs(majeurIds);

  if (majeurIds.length === 0) {
    return [];
  }

  let clesData: CleRow[];
  try {
    clesData = await chargerClesParMajeurIds(majeurIds);
  } catch (error) {
    console.error("getClesData cles", error);
    return [];
  }

  const clesParMajeur = new Map<string, CleRow>();
  for (const cle of clesData) {
    clesParMajeur.set(cle.majeur_id, cle);
  }

  const mjpmParOrganisation = new Map<string, UtilisateurRow>();
  for (const utilisateur of mjpmUtilisateurs) {
    if (!mjpmParOrganisation.has(utilisateur.organisation_id)) {
      mjpmParOrganisation.set(utilisateur.organisation_id, utilisateur);
    }
  }

  const mjpmProfiles = new Map<string, MjpmProfile>();
  await Promise.all(
    Array.from(mjpmParOrganisation.entries()).map(async ([orgId, utilisateur]) => {
      const profile = await enrichMjpmProfile(utilisateur.id);
      mjpmProfiles.set(orgId, profile);
    }),
  );

  const groupesMap = new Map<string, OrganisationClesGroupe>();

  for (const majeur of majeurs) {
    const cle = clesParMajeur.get(majeur.id);
    if (!cle) {
      continue;
    }

    const protege: CleProtege = {
      cleId: cle.id,
      majeurId: majeur.id,
      nom: majeur.nom,
      prenom: majeur.prenom,
      statut: cle.statut,
      notes: cle.notes,
    };

    const groupe = groupesMap.get(majeur.organisation_id);
    if (groupe) {
      groupe.proteges.push(protege);
    } else {
      groupesMap.set(majeur.organisation_id, {
        organisationId: majeur.organisation_id,
        mjpm: mjpmProfiles.get(majeur.organisation_id) ?? null,
        proteges: [protege],
      });
    }
  }

  return Array.from(groupesMap.values()).sort((a, b) => {
    const nomA = a.mjpm
      ? `${a.mjpm.nom} ${a.mjpm.prenom}`.trim().toLowerCase()
      : "";
    const nomB = b.mjpm
      ? `${b.mjpm.nom} ${b.mjpm.prenom}`.trim().toLowerCase()
      : "";
    return nomA.localeCompare(nomB, "fr");
  });
}

export interface CleDetailMobile {
  cleId: string;
  majeurId: string;
  nom: string;
  prenom: string;
  statut: StatutCle;
  notes: string | null;
  mjpmNom: string;
}

export async function getCleById(
  cleId: string,
): Promise<CleDetailMobile | null> {
  const groupes = await getClesData();

  for (const groupe of groupes) {
    const protege = groupe.proteges.find((item) => item.cleId === cleId);
    if (protege) {
      const mjpmNom = groupe.mjpm
        ? `${groupe.mjpm.prenom} ${groupe.mjpm.nom}`.trim() || "—"
        : "—";

      return {
        cleId: protege.cleId,
        majeurId: protege.majeurId,
        nom: protege.nom,
        prenom: protege.prenom,
        statut: protege.statut,
        notes: protege.notes,
        mjpmNom,
      };
    }
  }

  return null;
}
