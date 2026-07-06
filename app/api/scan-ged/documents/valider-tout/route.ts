import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { deplacerEtClasserDocument } from "@/lib/documents/non-classes-server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireScanGedAccess } from "@/lib/scan-ged/auth";
import type { DocumentNonClasse } from "@/types/documents";

export const runtime = "nodejs";

interface DocumentAValider {
  documentId: string;
  categorieId: string;
  majeurId: string;
  nom: string;
}

interface ValiderToutBody {
  documents: DocumentAValider[];
}

export async function POST(request: Request) {
  if (!(await requireScanGedAccess())) {
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

  for (const entree of body.documents) {
    if (!entree.categorieId || !entree.majeurId || !entree.nom?.trim()) {
      erreurs.push(`${entree.documentId} : champs incomplets`);
      continue;
    }

    try {
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", entree.documentId)
        .is("categorie_id", null)
        .single();

      if (documentError || !document) {
        erreurs.push(`${entree.documentId} : introuvable`);
        continue;
      }

      await deplacerEtClasserDocument({
        document: document as DocumentNonClasse,
        categorieId: entree.categorieId,
        majeurId: entree.majeurId,
        nom: entree.nom,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de validation";
      erreurs.push(`${entree.documentId} : ${message}`);
    }
  }

  if (erreurs.length === body.documents.length) {
    return NextResponse.json({ error: erreurs.join(" | ") }, { status: 400 });
  }

  revalidatePath("/scan-ged");

  return NextResponse.json({
    succes: body.documents.length - erreurs.length,
    erreurs: erreurs.length > 0 ? erreurs : undefined,
  });
}
