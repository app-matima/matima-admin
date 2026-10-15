import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { deplacerEtClasserDocument } from "@/lib/documents/non-classes-server";
import { declencherExtractionReleveApresClassement } from "@/lib/documents/declencher-extraction-releve-apres-classement";
import {
  MAX_DOCUMENTS_VALIDER_TOUT,
  MESSAGE_FICHIER_INTROUVABLE,
} from "@/lib/documents/orchestrer-deplacement-classement";
import { chargerMajeurPourClassementScanGed } from "@/lib/scan-ged/charger-majeur-pour-classement";
import {
  DocumentDejaClasseError,
  documentAppartientAAdmin,
} from "@/lib/scan-ged/filtrer-documents-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";
import type { DocumentNonClasse } from "@/types/documents";

export const runtime = "nodejs";
export const maxDuration = 120;

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

export interface ErreurValidationDocument {
  documentId: string;
  message: string;
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

  if (body.documents.length > MAX_DOCUMENTS_VALIDER_TOUT) {
    return NextResponse.json(
      {
        error: `Trop de documents dans un seul appel (max ${MAX_DOCUMENTS_VALIDER_TOUT}).`,
        succes: 0,
        valides: [],
        conflits: [],
        erreurs: [],
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const erreurs: ErreurValidationDocument[] = [];
  const conflits: string[] = [];
  const valides: string[] = [];
  const extractions: {
    documentId: string;
    typeDocument: string;
    gedDossierId: string | null | undefined;
  }[] = [];

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
      erreurs.push({
        documentId: entree.documentId,
        message: "champs incomplets",
      });
      continue;
    }

    try {
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", entree.documentId)
        .maybeSingle();

      if (documentError || !document) {
        erreurs.push({
          documentId: entree.documentId,
          message: "introuvable",
        });
        continue;
      }

      if (document.majeur_id != null) {
        conflits.push(entree.documentId);
        continue;
      }

      if (
        !documentAppartientAAdmin(
          (document as DocumentNonClasse).scan_admin_user_id,
          admin.id,
        )
      ) {
        erreurs.push({
          documentId: entree.documentId,
          message: "document d'un autre administrateur",
        });
        continue;
      }

      const majeur = await chargerMajeurPourClassementScanGed(supabase, {
        majeurId: entree.majeurId,
        organisationId: (document as DocumentNonClasse).organisation_id,
      });

      if (!majeur) {
        erreurs.push({
          documentId: entree.documentId,
          message:
            "Protégé introuvable ou n'appartenant pas à cette organisation.",
        });
        continue;
      }

      const documentClasse = await deplacerEtClasserDocument({
        document: document as DocumentNonClasse,
        gedDossierId,
        nouveauCheminDossier: nouveauChemin,
        majeurId: majeur.id,
        nom: entree.nom,
      });

      valides.push(entree.documentId);
      extractions.push({
        documentId: documentClasse.id,
        typeDocument: documentClasse.type_document,
        gedDossierId: documentClasse.ged_dossier_id,
      });
    } catch (error) {
      if (error instanceof DocumentDejaClasseError) {
        conflits.push(entree.documentId);
        continue;
      }

      const message =
        error instanceof Error ? error.message : "Erreur de validation";
      erreurs.push({
        documentId: entree.documentId,
        message:
          message.trim() === MESSAGE_FICHIER_INTROUVABLE
            ? MESSAGE_FICHIER_INTROUVABLE
            : message,
      });
    }
  }

  if (extractions.length > 0) {
    after(async () => {
      for (const item of extractions) {
        await declencherExtractionReleveApresClassement(item);
      }
    });
  }

  revalidatePath("/scan-ged");

  // Aucun succès ni conflit idempotent : échec global du lot
  if (valides.length === 0 && conflits.length === 0) {
    return NextResponse.json(
      {
        error: erreurs.map((e) => `${e.documentId} : ${e.message}`).join(" | "),
        succes: 0,
        valides,
        conflits,
        erreurs,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    succes: valides.length,
    valides,
    conflits,
    erreurs,
  });
}
