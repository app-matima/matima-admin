import {
  dossierDejaPresent,
  normaliserLibelleDossier,
} from "@/lib/parametres/dossiers-a-consulter";
import type { SupabaseClient } from "@supabase/supabase-js";

interface GedDossierParentRow {
  id: string;
  nom: string;
  parent_id: string | null;
}

/** Remonte l'arborescence GED et retourne le nom du dossier final puis ceux de ses parents. */
export async function getNomsDossierEtParents(
  supabase: SupabaseClient,
  gedDossierId: string,
): Promise<string[]> {
  const noms: string[] = [];
  let courantId: string | null = gedDossierId;

  while (courantId) {
    const { data, error } = await supabase
      .from("ged_dossiers")
      .select("id, nom, parent_id")
      .eq("id", courantId)
      .single();

    if (error || !data) {
      break;
    }

    const dossier = data as GedDossierParentRow;
    noms.push(normaliserLibelleDossier(dossier.nom));
    courantId = dossier.parent_id;
  }

  return noms;
}

export async function getDossiersAConsulterMjpmOrganisation(
  supabase: SupabaseClient,
  organisationId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("utilisateurs")
    .select("dossiers_a_consulter")
    .eq("organisation_id", organisationId)
    .eq("est_principal", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.dossiers_a_consulter ?? [];
}

export function documentDoitEtreAConsulter(
  nomsDossier: string[],
  dossiersAConsulter: string[],
): boolean {
  if (nomsDossier.length === 0 || dossiersAConsulter.length === 0) {
    return false;
  }

  return nomsDossier.some((nom) => dossierDejaPresent(dossiersAConsulter, nom));
}

export async function resoudreAConsulterPourDossier(
  supabase: SupabaseClient,
  params: {
    organisationId: string;
    gedDossierId: string | null;
  },
): Promise<boolean> {
  if (!params.gedDossierId) {
    return false;
  }

  const [nomsDossier, dossiersAConsulter] = await Promise.all([
    getNomsDossierEtParents(supabase, params.gedDossierId),
    getDossiersAConsulterMjpmOrganisation(supabase, params.organisationId),
  ]);

  return documentDoitEtreAConsulter(nomsDossier, dossiersAConsulter);
}
