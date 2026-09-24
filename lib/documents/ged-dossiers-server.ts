import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatCheminDossier,
  nomsDossiersQuasiIdentiques,
} from "@/lib/documents/ged-dossier-utils";
import type { GedDossier } from "@/types/documents";

export interface DossierOrganisationRow {
  id: string;
  nom: string;
  majeur_id: string;
  parent_id: string | null;
}

export async function createGedDossierServeur(
  adminClient: SupabaseClient,
  params: {
    organisationId: string;
    majeurId: string;
    parentId?: string | null;
    nom: string;
    creeParIa?: boolean;
  },
): Promise<GedDossier> {
  const { data, error } = await adminClient
    .from("ged_dossiers")
    .insert({
      organisation_id: params.organisationId,
      majeur_id: params.majeurId,
      parent_id: params.parentId ?? null,
      nom: params.nom.trim(),
      cree_par_ia: params.creeParIa ?? false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de créer le dossier.");
  }

  return data as GedDossier;
}

export function resoudreDossierExistantProposition(params: {
  majeurId: string | null;
  gedDossierId: string | null;
  dossiers: DossierOrganisationRow[];
}): string | null {
  if (!params.majeurId || !params.gedDossierId) {
    return null;
  }

  const existant = params.dossiers.find(
    (dossier) =>
      dossier.id === params.gedDossierId &&
      dossier.majeur_id === params.majeurId,
  );

  return existant?.id ?? null;
}

export async function creerOuRecupererDossier(
  adminClient: SupabaseClient,
  params: {
    organisationId: string;
    majeurId: string;
    parentId: string | null;
    nom: string;
    creeParIa?: boolean;
  },
): Promise<string> {
  const nom = params.nom.trim();
  if (!nom) {
    throw new Error("Le nom du dossier est obligatoire.");
  }

  let query = adminClient
    .from("ged_dossiers")
    .select("id, nom")
    .eq("organisation_id", params.organisationId)
    .eq("majeur_id", params.majeurId);

  if (params.parentId === null) {
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", params.parentId);
  }

  const { data: existants, error: lectureError } = await query;

  if (lectureError) {
    throw new Error(lectureError.message);
  }

  const dejaPresent = (existants ?? []).find((dossier) =>
    nomsDossiersQuasiIdentiques(dossier.nom, nom),
  );
  if (dejaPresent) {
    return dejaPresent.id;
  }

  const cree = await createGedDossierServeur(adminClient, {
    organisationId: params.organisationId,
    majeurId: params.majeurId,
    parentId: params.parentId,
    nom,
    creeParIa: params.creeParIa ?? false,
  });

  return cree.id;
}

/** Parcourt ou crée chaque segment du chemin et retourne l'id du dossier final. */
export async function creerOuRecupererCheminDossier(
  adminClient: SupabaseClient,
  params: {
    organisationId: string;
    majeurId: string;
    segments: string[];
    creeParIa?: boolean;
  },
): Promise<string> {
  const segments = params.segments
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error("Le chemin de dossiers proposé est vide.");
  }

  let parentId: string | null = null;

  for (const nom of segments) {
    parentId = await creerOuRecupererDossier(adminClient, {
      organisationId: params.organisationId,
      majeurId: params.majeurId,
      parentId,
      nom,
      creeParIa: params.creeParIa ?? false,
    });
  }

  if (!parentId) {
    throw new Error("Impossible de résoudre le chemin de dossiers proposé.");
  }

  return parentId;
}

export function formaterDossiersOrganisationPourPrompt(
  dossiers: DossierOrganisationRow[],
  majeurId: string,
): string {
  const dossiersMajeur = dossiers.filter(
    (dossier) => dossier.majeur_id === majeurId,
  );

  if (dossiersMajeur.length === 0) {
    return "  (aucun dossier existant)";
  }

  const commeGed = dossiersMajeur.map(
    (dossier) =>
      ({
        id: dossier.id,
        nom: dossier.nom,
        parent_id: dossier.parent_id,
      }) as GedDossier,
  );

  return dossiersMajeur
    .map((dossier) => {
      const chemin = formatCheminDossier(dossier.id, commeGed);
      return `  - ${chemin} (id: ${dossier.id})`;
    })
    .join("\n");
}
