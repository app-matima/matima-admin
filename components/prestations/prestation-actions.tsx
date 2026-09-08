"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePrestationStatut } from "@/lib/prestations/actions";
import {
  devisBloqueDemarrage,
  MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER,
} from "@/lib/prestations/utils";
import { cn } from "@/lib/utils";
import type { StatutPrestation } from "@/types";

interface PrestationActionsProps {
  prestationId: string;
  statut: StatutPrestation;
  devisStoragePath?: string | null;
  devisSigneStoragePath?: string | null;
  layout?: "inline" | "modal";
  onStatutUpdated?: (statut: StatutPrestation) => void;
  onMarquerRealisee?: () => void;
}

const primaryButtonClass =
  "rounded-lg bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded-lg border border-[#FECACA] bg-transparent text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50";

export function PrestationActions({
  prestationId,
  statut,
  devisStoragePath = null,
  devisSigneStoragePath = null,
  layout = "inline",
  onStatutUpdated,
  onMarquerRealisee,
}: PrestationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const demarrageBloqueParDevis = devisBloqueDemarrage({
    devis_storage_path: devisStoragePath,
    devis_signe_storage_path: devisSigneStoragePath,
  });

  function handleAction(nouveauStatut: StatutPrestation) {
    if (nouveauStatut === "en_cours" && demarrageBloqueParDevis) {
      setErreur(MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER);
      return;
    }

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

  const actions = getActionsForStatut(
    statut,
    handleAction,
    isPending,
    layout,
    onMarquerRealisee,
    demarrageBloqueParDevis,
  );

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
      {demarrageBloqueParDevis && statut === "confirme" ? (
        <p className="text-xs text-[#B45309]">
          {MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER}
        </p>
      ) : null}
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
  onMarquerRealisee: (() => void) | undefined,
  demarrageBloqueParDevis: boolean,
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
          disabled={disabled || demarrageBloqueParDevis}
          title={
            demarrageBloqueParDevis
              ? MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER
              : undefined
          }
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
          onClick={() =>
            onMarquerRealisee ? onMarquerRealisee() : handleAction("realise")
          }
          className={getButtonClass("primary", layout)}
        >
          Marquer réalisée
        </button>,
      ];
    default:
      return [];
  }
}
