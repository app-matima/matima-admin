import { createHash } from "crypto";
import {
  BUDGET_MS_BACKFILL_EMPREINTES,
  CONCURRENCE_TELECHARGEMENT_BACKFILL,
  TAILLE_LOT_BACKFILL_EMPREINTES,
  estContenuSha256Valide,
  normaliserContenuSha256,
  type DoublonConnuScanGed,
} from "@/lib/documents/scan-ged-empreintes";
import { messageErreurCopieStorage } from "@/lib/documents/orchestrer-deplacement-classement";
import { createAdminClient } from "@/lib/supabase/server";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "documents";

interface DocumentEmpreinteRow {
  id: string;
  nom_original: string;
  created_at: string | null;
  contenu_sha256: string;
  majeur_id: string | null;
  ged_dossier_id: string | null;
}

interface MajeurNomRow {
  id: string;
  nom: string;
  prenom: string;
}

interface DossierNomRow {
  id: string;
  nom: string;
}

/**
 * Recherche les hash déjà connus dans toute l'organisation (file + GED).
 * `organisationId` doit venir de l'URL (jamais du body client).
 */
export async function rechercherEmpreintesConnuesOrganisation(params: {
  organisationId: string;
  hashes: string[];
  adminClient?: SupabaseClient;
}): Promise<DoublonConnuScanGed[]> {
  const hashes = [
    ...new Set(
      params.hashes
        .map((hash) => normaliserContenuSha256(hash))
        .filter((hash): hash is string => hash !== null),
    ),
  ];

  if (hashes.length === 0) {
    return [];
  }

  const adminClient = params.adminClient ?? createAdminClient();

  const documents = await chargerToutesLesLignes<DocumentEmpreinteRow>(() =>
    adminClient
      .from("documents")
      .select(
        "id, nom_original, created_at, contenu_sha256, majeur_id, ged_dossier_id",
      )
      .eq("organisation_id", params.organisationId)
      .in("contenu_sha256", hashes),
  );

  if (documents.length === 0) {
    return [];
  }

  const majeurIds = [
    ...new Set(
      documents
        .map((doc) => doc.majeur_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const dossierIds = [
    ...new Set(
      documents
        .map((doc) => doc.ged_dossier_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [majeurs, dossiers] = await Promise.all([
    majeurIds.length === 0
      ? Promise.resolve([] as MajeurNomRow[])
      : chargerToutesLesLignes<MajeurNomRow>(() =>
          adminClient
            .from("majeurs")
            .select("id, nom, prenom")
            .eq("organisation_id", params.organisationId)
            .in("id", majeurIds),
        ),
    dossierIds.length === 0
      ? Promise.resolve([] as DossierNomRow[])
      : chargerToutesLesLignes<DossierNomRow>(() =>
          adminClient
            .from("ged_dossiers")
            .select("id, nom")
            .eq("organisation_id", params.organisationId)
            .in("id", dossierIds),
        ),
  ]);

  const majeursParId = new Map(
    majeurs.map((majeur) => [
      majeur.id,
      `${majeur.prenom} ${majeur.nom}`.trim(),
    ]),
  );
  const dossiersParId = new Map(
    dossiers.map((dossier) => [dossier.id, dossier.nom]),
  );

  // Un seul match par hash (le plus ancien) pour l'UI.
  const parHash = new Map<string, DoublonConnuScanGed>();

  const tries = [...documents].sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
  );

  for (const doc of tries) {
    if (!estContenuSha256Valide(doc.contenu_sha256)) {
      continue;
    }
    if (parHash.has(doc.contenu_sha256)) {
      continue;
    }

    if (!doc.majeur_id) {
      parHash.set(doc.contenu_sha256, {
        contenuSha256: doc.contenu_sha256,
        documentId: doc.id,
        nomOriginal: doc.nom_original,
        createdAt: doc.created_at,
        emplacement: {
          type: "file",
          libelle: "dans la file Scan GED",
        },
      });
      continue;
    }

    const majeurNom =
      majeursParId.get(doc.majeur_id)?.trim() || "protégé inconnu";
    const dossierNom = doc.ged_dossier_id
      ? dossiersParId.get(doc.ged_dossier_id) ?? null
      : null;

    parHash.set(doc.contenu_sha256, {
      contenuSha256: doc.contenu_sha256,
      documentId: doc.id,
      nomOriginal: doc.nom_original,
      createdAt: doc.created_at,
      emplacement: {
        type: "ged",
        libelle: dossierNom
          ? `dans la GED de ${majeurNom} (${dossierNom})`
          : `dans la GED de ${majeurNom}`,
        majeurId: doc.majeur_id,
        majeurNom,
        dossierNom,
      },
    });
  }

  return Array.from(parHash.values());
}

export async function compterDocumentsScanGedSansEmpreinte(
  organisationId: string,
  adminClient: SupabaseClient = createAdminClient(),
): Promise<number> {
  const lignes = await chargerToutesLesLignes<{ id: string }>(() =>
    adminClient
      .from("documents")
      .select("id")
      .eq("organisation_id", organisationId)
      .not("statut_classement", "is", null)
      .is("contenu_sha256", null),
  );
  return lignes.length;
}

async function telechargerEtHasherDocument(params: {
  adminClient: SupabaseClient;
  documentId: string;
  storagePath: string;
}): Promise<"ok" | "erreur"> {
  const { data, error } = await params.adminClient.storage
    .from(BUCKET)
    .download(params.storagePath);

  if (error || !data) {
    const message = messageErreurCopieStorage(
      error?.message ?? "Fichier introuvable",
    );
    console.error(
      "[backfill-empreintes]",
      params.documentId,
      message,
    );
    return "erreur";
  }

  const octets = new Uint8Array(await data.arrayBuffer());
  const hash = createHash("sha256").update(octets).digest("hex");

  const { error: updateError } = await params.adminClient
    .from("documents")
    .update({ contenu_sha256: hash })
    .eq("id", params.documentId)
    .is("contenu_sha256", null);

  if (updateError) {
    console.error(
      "[backfill-empreintes] update",
      params.documentId,
      updateError.message,
    );
    return "erreur";
  }

  return "ok";
}

/**
 * Calcule les empreintes manquantes (Scan GED uniquement), lots ≤ 50,
 * ≤ 5 téléchargements en parallèle, budget ~200 s.
 */
export async function calculerEmpreintesDocumentsScanGedLot(params: {
  organisationId: string;
  taille?: number;
  adminClient?: SupabaseClient;
  maintenantMs?: () => number;
}): Promise<{
  traites: number;
  succes: number;
  erreurs: number;
  restant: number;
  arreteBudget: boolean;
}> {
  const adminClient = params.adminClient ?? createAdminClient();
  const taille = Math.min(
    Math.max(params.taille ?? TAILLE_LOT_BACKFILL_EMPREINTES, 1),
    TAILLE_LOT_BACKFILL_EMPREINTES,
  );
  const maintenant = params.maintenantMs ?? Date.now;
  const debut = maintenant();

  const { data: candidats, error } = await adminClient
    .from("documents")
    .select("id, storage_path")
    .eq("organisation_id", params.organisationId)
    .not("statut_classement", "is", null)
    .is("contenu_sha256", null)
    .order("created_at", { ascending: true })
    .limit(taille);

  if (error) {
    throw new Error(error.message);
  }

  const aTraiter = (candidats ?? []).filter(
    (doc): doc is { id: string; storage_path: string } =>
      typeof doc.id === "string" &&
      typeof doc.storage_path === "string" &&
      doc.storage_path.trim().length > 0,
  );

  let succes = 0;
  let erreurs = 0;
  let traites = 0;
  let arreteBudget = false;

  for (
    let debutLot = 0;
    debutLot < aTraiter.length;
    debutLot += CONCURRENCE_TELECHARGEMENT_BACKFILL
  ) {
    if (maintenant() - debut >= BUDGET_MS_BACKFILL_EMPREINTES) {
      arreteBudget = true;
      break;
    }

    const paquet = aTraiter.slice(
      debutLot,
      debutLot + CONCURRENCE_TELECHARGEMENT_BACKFILL,
    );

    const resultats = await Promise.all(
      paquet.map((doc) =>
        telechargerEtHasherDocument({
          adminClient,
          documentId: doc.id,
          storagePath: doc.storage_path,
        }),
      ),
    );

    for (const resultat of resultats) {
      traites += 1;
      if (resultat === "ok") {
        succes += 1;
      } else {
        erreurs += 1;
      }
    }
  }

  const restant = await compterDocumentsScanGedSansEmpreinte(
    params.organisationId,
    adminClient,
  );

  return { traites, succes, erreurs, restant, arreteBudget };
}
