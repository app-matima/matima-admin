"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { PrestationActions } from "@/components/prestations/prestation-actions";
import {
  formatHeureSouhaitee,
  getNomMajeur,
  getNomOrganisation,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage, formatDateTimeAffichage } from "@/lib/utils/date";
import type { PrestationAvecRelations, StatutPrestation } from "@/types";

interface PrestationDetailModalProps {
  prestation: PrestationAvecRelations | null;
  onClose: () => void;
}

export function PrestationDetailModal({
  prestation,
  onClose,
}: PrestationDetailModalProps) {
  const [statut, setStatut] = useState<StatutPrestation | null>(null);

  useEffect(() => {
    if (prestation) {
      setStatut(prestation.statut);
    }
  }, [prestation]);

  useEffect(() => {
    if (!prestation) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [prestation, onClose]);

  if (!prestation || !statut) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prestation-detail-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={onClose}
        aria-label="Fermer la modale"
      />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2
              id="prestation-detail-titre"
              className="text-lg font-medium text-text-strong"
            >
              Détail de la prestation
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {getNomMajeur(prestation.majeurs)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Statut</span>
            <Badge variant={getStatutPrestationBadgeVariant(statut)}>
              {getStatutPrestationLabel(statut)}
            </Badge>
          </div>

          <DetailField label="Protégé">
            {getNomMajeur(prestation.majeurs)}
          </DetailField>

          <DetailField label="Cabinet">
            {getNomOrganisation(prestation.organisations)}
          </DetailField>

          <DetailField label="Description">
            <p className="whitespace-pre-wrap">{prestation.description}</p>
          </DetailField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField label="Date souhaitée">
              {formatDateAffichage(prestation.date_souhaitee)}
            </DetailField>
            <DetailField label="Heure">
              {formatHeureSouhaitee(prestation.heure_souhaitee)}
            </DetailField>
          </div>

          <DetailField label="Adresse d'intervention">
            <p className="whitespace-pre-wrap">
              {prestation.adresse_intervention?.trim() || "—"}
            </p>
          </DetailField>

          <DetailField label="Instructions">
            <p className="whitespace-pre-wrap">
              {prestation.instructions?.trim() || "—"}
            </p>
          </DetailField>

          <DetailField label="Date de création">
            {formatDateTimeAffichage(prestation.created_at)}
          </DetailField>
        </div>

        <div className="border-t border-border p-4">
          <PrestationActions
            prestationId={prestation.id}
            statut={statut}
            layout="modal"
            onStatutUpdated={setStatut}
          />
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-text-muted">{label}</p>
      <div className="text-sm text-text-strong">{children}</div>
    </div>
  );
}
