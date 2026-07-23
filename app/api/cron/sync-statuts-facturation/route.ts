import { NextResponse } from "next/server";
import {
  getStatutFactureClient,
  mapPennylaneToStatutFacturation,
} from "@/lib/pennylane/client";
import { createAdminClient } from "@/lib/supabase/server";
import type { StatutFacturation } from "@/types";

export const runtime = "nodejs";

const DELAI_ENTRE_APPELS_MS = 200;

function verifierAuthCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface PrestationASync {
  id: string;
  pennylane_invoice_id: string;
  statut_facturation: StatutFacturation;
}

interface ResultatSync {
  prestationId: string;
  pennylaneInvoiceId: string;
  statut: "ok" | "erreur" | "inchange";
  ancienStatut?: StatutFacturation;
  nouveauStatut?: StatutFacturation;
  raison?: string;
}

export async function GET(request: Request) {
  if (!verifierAuthCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("prestations_commandes")
    .select("id, pennylane_invoice_id, statut_facturation")
    .not("pennylane_invoice_id", "is", null)
    .neq("pennylane_invoice_id", "")
    .neq("statut_facturation", "payee");

  if (error) {
    console.error("[sync-statuts-facturation] fetch", error);
    return NextResponse.json(
      { error: "Impossible de lire les prestations à synchroniser." },
      { status: 500 },
    );
  }

  const prestations = (data ?? []) as PrestationASync[];
  const resultats: ResultatSync[] = [];
  let misesAJour = 0;
  let erreurs = 0;

  for (let index = 0; index < prestations.length; index += 1) {
    const prestation = prestations[index];
    const invoiceId = prestation.pennylane_invoice_id.trim();

    if (!invoiceId) {
      continue;
    }

    try {
      const statutPennylane = await getStatutFactureClient(invoiceId);
      const nouveauStatut = mapPennylaneToStatutFacturation(statutPennylane);

      if (nouveauStatut === prestation.statut_facturation) {
        resultats.push({
          prestationId: prestation.id,
          pennylaneInvoiceId: invoiceId,
          statut: "inchange",
          ancienStatut: prestation.statut_facturation,
          nouveauStatut,
        });
      } else {
        const { error: updateError } = await supabase
          .from("prestations_commandes")
          .update({ statut_facturation: nouveauStatut })
          .eq("id", prestation.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        misesAJour += 1;
        resultats.push({
          prestationId: prestation.id,
          pennylaneInvoiceId: invoiceId,
          statut: "ok",
          ancienStatut: prestation.statut_facturation,
          nouveauStatut,
        });
      }
    } catch (syncError) {
      erreurs += 1;
      const message =
        syncError instanceof Error ? syncError.message : "Erreur inconnue";
      console.error(
        `[sync-statuts-facturation] prestation ${prestation.id}`,
        message,
      );
      resultats.push({
        prestationId: prestation.id,
        pennylaneInvoiceId: invoiceId,
        statut: "erreur",
        raison: message,
      });
    }

    if (index < prestations.length - 1) {
      await attendre(DELAI_ENTRE_APPELS_MS);
    }
  }

  return NextResponse.json({
    success: true,
    total: prestations.length,
    misesAJour,
    erreurs,
    resultats,
  });
}
