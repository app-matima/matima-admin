"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { updateCleNotes, updateCleStatut } from "@/lib/cles/actions";
import type { CleDetailMobile } from "@/lib/cles/get-cles-data";
import {
  getNomProtege,
  getStatutCleBadgeVariant,
  getStatutCleLabel,
  statutsCle,
} from "@/lib/cles/utils";
import type { StatutCle } from "@/types/cles";

interface MobileCleDetailProps {
  cle: CleDetailMobile;
}

const inputClassName =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function MobileCleDetail({ cle }: MobileCleDetailProps) {
  const router = useRouter();
  const [statut, setStatut] = useState<StatutCle>(cle.statut);
  const [notes, setNotes] = useState(cle.notes ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStatut(cle.statut);
    setNotes(cle.notes ?? "");
  }, [cle.statut, cle.notes, cle.cleId]);

  function handleStatutChange(nouveauStatut: StatutCle) {
    const precedent = statut;
    setStatut(nouveauStatut);
    setErreur(null);

    startTransition(async () => {
      const result = await updateCleStatut(cle.cleId, nouveauStatut);
      if (!result.success) {
        setStatut(precedent);
        setErreur(result.error ?? "Impossible de mettre à jour le statut.");
        return;
      }
      router.refresh();
    });
  }

  function handleNotesSave() {
    const initiale = cle.notes ?? "";
    if (notes === initiale) {
      return;
    }

    setErreur(null);
    startTransition(async () => {
      const result = await updateCleNotes(cle.cleId, notes);
      if (!result.success) {
        setNotes(initiale);
        setErreur(result.error ?? "Impossible d'enregistrer les notes.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/m/cles"
          className="inline-flex items-center gap-1.5 text-sm text-accent transition-colors active:text-[#00796B]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Clés
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-text-strong">
            {getNomProtege(cle)}
          </h1>
          <Badge
            variant={getStatutCleBadgeVariant(statut)}
            className="shrink-0"
          >
            {getStatutCleLabel(statut)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-text-muted">{cle.mjpmNom}</p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <label
            htmlFor="cle-statut"
            className="mb-1.5 block text-xs font-medium text-text-muted"
          >
            Statut de la clé
          </label>
          <select
            id="cle-statut"
            value={statut}
            disabled={isPending}
            onChange={(event) =>
              handleStatutChange(event.target.value as StatutCle)
            }
            className={inputClassName}
          >
            {statutsCle.map((option) => (
              <option key={option} value={option}>
                {getStatutCleLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="cle-notes"
            className="mb-1.5 block text-xs font-medium text-text-muted"
          >
            Notes
          </label>
          <textarea
            id="cle-notes"
            rows={4}
            value={notes}
            disabled={isPending}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={handleNotesSave}
            placeholder="Ajouter une note…"
            className={inputClassName}
          />
        </div>

        {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
        {isPending && (
          <p className="text-xs text-text-muted">Enregistrement…</p>
        )}
      </section>
    </div>
  );
}
