"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { PrestationActions } from "@/components/prestations/prestation-actions";
import { SignatureModal } from "@/components/prestations/signature-modal";
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
  const router = useRouter();
  const [statut, setStatut] = useState<StatutPrestation | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

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
      if (event.key === "Escape" && !signatureOpen) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [prestation, onClose, signatureOpen]);

  if (!prestation || !statut) {
    return null;
  }

  const activePrestation = prestation;

  function handleAttestationSuccess() {
    setStatut("realise");
    setSignatureOpen(false);
    router.refresh();
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prestation-detail-titre"
      >
        <button
          type="button"
          className="absolute inset-0 bg-[#0F1923]/50"
          onClick={() => !signatureOpen && onClose()}
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
                {getNomMajeur(activePrestation.majeurs)}
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
              {getNomMajeur(activePrestation.majeurs)}
            </DetailField>

            <DetailField label="Cabinet">
              {getNomOrganisation(activePrestation.organisations)}
            </DetailField>

            <DetailField label="Description">
              <p className="whitespace-pre-wrap">{activePrestation.description}</p>
            </DetailField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailField label="Date souhaitée">
                {formatDateAffichage(activePrestation.date_souhaitee)}
              </DetailField>
              <DetailField label="Heure">
                {formatHeureSouhaitee(activePrestation.heure_souhaitee)}
              </DetailField>
            </div>

            <DetailField label="Adresse d'intervention">
              <p className="whitespace-pre-wrap">
                {activePrestation.adresse_intervention?.trim() || "—"}
              </p>
            </DetailField>

            <DetailField label="Instructions">
              <p className="whitespace-pre-wrap">
                {activePrestation.instructions?.trim() || "—"}
              </p>
            </DetailField>

            <DetailField label="Date de création">
              {formatDateTimeAffichage(activePrestation.created_at)}
            </DetailField>
          </div>

          <div className="space-y-3 border-t border-border p-4">
            {statut === "realise" && activePrestation.attestation_url && (
              <a
                href={`/api/storage/sign?path=${encodeURIComponent(activePrestation.attestation_url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto"
              >
                Voir l&apos;attestation
              </a>
            )}
            <PrestationActions
              prestationId={activePrestation.id}
              statut={statut}
              layout="modal"
              onStatutUpdated={setStatut}
              onMarquerRealisee={() => setSignatureOpen(true)}
            />
          </div>
        </div>
      </div>

      <SignatureModal
        open={signatureOpen}
        prestationId={activePrestation.id}
        onClose={() => setSignatureOpen(false)}
        onSuccess={handleAttestationSuccess}
      />
    </>
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
