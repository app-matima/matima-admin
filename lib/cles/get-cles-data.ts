import { createAdminClient } from "@/lib/supabase/server";
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

async function ensureClesForMajeurs(majeurIds: string[]): Promise<void> {
  if (majeurIds.length === 0) {
    return;
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("cles")
    .select("majeur_id")
    .in("majeur_id", majeurIds);

  if (fetchError) {
    console.error("ensureClesForMajeurs fetch", fetchError);
    return;
  }

  const existingIds = new Set(
    (existing ?? []).map((row) => row.majeur_id as string),
  );
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

  const [majeursResult, mjpmResult] = await Promise.all([
    supabase
      .from("majeurs")
      .select("id, organisation_id, nom, prenom")
      .order("nom", { ascending: true }),
    supabase
      .from("utilisateurs")
      .select("id, organisation_id, role")
      .eq("role", "mjpm"),
  ]);

  if (majeursResult.error) {
    console.error("getClesData majeurs", majeursResult.error);
    return [];
  }

  const majeurs = (majeursResult.data ?? []) as MajeurRow[];
  const majeurIds = majeurs.map((majeur) => majeur.id);

  await ensureClesForMajeurs(majeurIds);

  if (majeurIds.length === 0) {
    return [];
  }

  const { data: clesData, error: clesError } = await supabase
    .from("cles")
    .select("id, majeur_id, statut, notes")
    .in("majeur_id", majeurIds);

  if (clesError) {
    console.error("getClesData cles", clesError);
    return [];
  }

  const clesParMajeur = new Map<string, CleRow>();
  for (const cle of (clesData ?? []) as CleRow[]) {
    clesParMajeur.set(cle.majeur_id, cle);
  }

  const mjpmUtilisateurs = (mjpmResult.data ?? []) as UtilisateurRow[];
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
