"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { updatePrestationStatut } from "@/lib/prestations/actions";
import {
  formatHeureSouhaitee,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { cn } from "@/lib/utils";
import type { StatutPrestation } from "@/types";

interface PrestationActionsProps {
  prestationId: string;
  statut: StatutPrestation;
  layout?: "inline" | "modal";
  onStatutUpdated?: (statut: StatutPrestation) => void;
}

const primaryButtonClass =
  "rounded-lg bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded-lg border border-[#FECACA] bg-transparent text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50";

export function PrestationActions({
  prestationId,
  statut,
  layout = "inline",
  onStatutUpdated,
}: PrestationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function handleAction(nouveauStatut: StatutPrestation) {
    setErreur(null);
    startTransition(async () => {
      const result = await updatePrestationStatut(prestationId, nouveauStatut);
      if (!result.success) {
        setErreur(result.error ?? "Impossible de mettre à jour le statut.");
        return;
      }
      onStatutUpdated?.(nouveauStatut);
      router.refresh();
    });
  }

  const actions = getActionsForStatut(statut, handleAction, isPending, layout);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-wrap gap-2",
          layout === "modal" && "flex-col sm:flex-row sm:flex-wrap",
        )}
      >
        {actions}
      </div>
      {erreur && <p className="text-xs text-[#DC2626]">{erreur}</p>}
    </div>
  );
}

function getButtonClass(
  variant: "primary" | "danger",
  layout: "inline" | "modal",
): string {
  const base = variant === "primary" ? primaryButtonClass : dangerButtonClass;
  const size =
    layout === "modal"
      ? "w-full px-4 py-2.5 sm:w-auto sm:px-3 sm:py-1.5 text-sm"
      : "px-3 py-1.5 text-xs";

  return cn(base, size);
}

function getActionsForStatut(
  statut: StatutPrestation,
  handleAction: (statut: StatutPrestation) => void,
  disabled: boolean,
  layout: "inline" | "modal",
) {
  switch (statut) {
    case "en_attente":
      return [
        <button
          key="confirmer"
          type="button"
          disabled={disabled}
          onClick={() => handleAction("confirme")}
          className={getButtonClass("primary", layout)}
        >
          Confirmer
        </button>,
        <button
          key="annuler"
          type="button"
          disabled={disabled}
          onClick={() => handleAction("annule")}
          className={getButtonClass("danger", layout)}
        >
          Annuler
        </button>,
      ];
    case "confirme":
      return [
        <button
          key="demarrer"
          type="button"
          disabled={disabled}
          onClick={() => handleAction("en_cours")}
          className={getButtonClass("primary", layout)}
        >
          Démarrer
        </button>,
        <button
          key="annuler"
          type="button"
          disabled={disabled}
          onClick={() => handleAction("annule")}
          className={getButtonClass("danger", layout)}
        >
          Annuler
        </button>,
      ];
    case "en_cours":
      return [
        <button
          key="realise"
          type="button"
          disabled={disabled}
          onClick={() => handleAction("realise")}
          className={getButtonClass("primary", layout)}
        >
          Marquer réalisée
        </button>,
      ];
    default:
      return [];
  }
}
