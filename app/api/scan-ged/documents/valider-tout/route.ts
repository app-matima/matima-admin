import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deplacerEtClasserDocument } from "@/lib/documents/non-classes-server";
import { lancerExtractionReleveEnArrierePlan } from "@/lib/documents/declencher-extraction-releve-apres-classement";
import {
  DocumentDejaClasseError,
  MESSAGE_DOCUMENT_DEJA_CLASSE,
  documentAppartientAAdmin,
} from "@/lib/scan-ged/filtrer-documents-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";
import type { DocumentNonClasse } from "@/types/documents";

export const runtime = "nodejs";

interface DocumentAValider {
  documentId: string;
  gedDossierId?: string | null;
  nouveauCheminDossier?: string[] | null;
  majeurId: string;
  nom: string;
}

interface ValiderToutBody {
  documents: DocumentAValider[];
}

function cheminDossierNonVide(valeur: unknown): string[] | null {
  if (!Array.isArray(valeur)) {
    return null;
  }

  const segments = valeur
    .filter((segment): segment is string => typeof segment === "string")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length > 0 ? segments : null;
}

export async function POST(request: Request) {
  const admin = await requireScanGedAccess();
  if (!admin) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  let body: ValiderToutBody;

  try {
    body = (await request.json()) as ValiderToutBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.documents) || body.documents.length === 0) {
    return NextResponse.json(
      { error: "Aucun document à valider." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const erreurs: string[] = [];
  const conflits: string[] = [];
  const valides: string[] = [];

  for (const entree of body.documents) {
    const nouveauChemin = cheminDossierNonVide(entree.nouveauCheminDossier);
    const gedDossierId =
      typeof entree.gedDossierId === "string" && entree.gedDossierId.trim()
        ? entree.gedDossierId.trim()
        : null;

    if (
      !entree.majeurId ||
      !entree.nom?.trim() ||
      (!gedDossierId && !nouveauChemin) ||
      (gedDossierId && nouveauChemin)
    ) {
      erreurs.push(`${entree.documentId} : champs incomplets`);
      continue;
    }

    try {
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", entree.documentId)
        .maybeSingle();

      if (documentError || !document) {
        erreurs.push(`${entree.documentId} : introuvable`);
        continue;
      }

      if (document.majeur_id != null) {
        conflits.push(entree.documentId);
        erreurs.push(`${entree.documentId} : ${MESSAGE_DOCUMENT_DEJA_CLASSE}`);
        continue;
      }

      if (
        !documentAppartientAAdmin(
          (document as DocumentNonClasse).scan_admin_user_id,
          admin.id,
        )
      ) {
        erreurs.push(
          `${entree.documentId} : document d'un autre administrateur`,
        );
        continue;
      }

      const documentClasse = await deplacerEtClasserDocument({
        document: document as DocumentNonClasse,
        gedDossierId,
        nouveauCheminDossier: nouveauChemin,
        majeurId: entree.majeurId,
        nom: entree.nom,
      });

      lancerExtractionReleveEnArrierePlan({
        documentId: documentClasse.id,
        typeDocument: documentClasse.type_document,
        gedDossierId: documentClasse.ged_dossier_id,
      });

      valides.push(entree.documentId);
    } catch (error) {
      if (error instanceof DocumentDejaClasseError) {
        conflits.push(entree.documentId);
        erreurs.push(`${entree.documentId} : ${error.message}`);
        continue;
      }

      const message =
        error instanceof Error ? error.message : "Erreur de validation";
      erreurs.push(`${entree.documentId} : ${message}`);
    }
  }

  if (valides.length === 0 && erreurs.length === body.documents.length) {
    const status = conflits.length === body.documents.length ? 409 : 400;
    return NextResponse.json({ error: erreurs.join(" | "), conflits }, { status });
  }

  revalidatePath("/scan-ged");

  return NextResponse.json({
    succes: valides.length,
    valides,
    conflits: conflits.length > 0 ? conflits : undefined,
    erreurs: erreurs.length > 0 ? erreurs : undefined,
  });
}
