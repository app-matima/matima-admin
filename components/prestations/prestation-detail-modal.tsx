"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { PrestationActions } from "@/components/prestations/prestation-actions";
import { PrestationFacturationForm } from "@/components/prestations/prestation-facturation-form";
import { SignatureModal } from "@/components/prestations/signature-modal";
import {
  formatHeureSouhaitee,
  getNomCompletMajeur,
  getNomMajeur,
  getNomOrganisation,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage, formatDateTimeAffichage } from "@/lib/utils/date";
import type {
  PrestationAvecRelations,
  StatutFacturation,
  StatutPrestation,
} from "@/types";

interface PrestationDetailModalProps {
  prestation: PrestationAvecRelations | null;
  onClose: () => void;
  canManageStatut?: boolean;
}

export function PrestationDetailModal({
  prestation,
  onClose,
  canManageStatut = true,
}: PrestationDetailModalProps) {
  const router = useRouter();
  const devisInputRef = useRef<HTMLInputElement>(null);
  const [statut, setStatut] = useState<StatutPrestation | null>(null);
  const [statutFacturation, setStatutFacturation] =
    useState<StatutFacturation>("a_facturer");
  const [pennylaneInvoiceId, setPennylaneInvoiceId] = useState<string | null>(
    null,
  );
  const [devisStoragePath, setDevisStoragePath] = useState<string | null>(null);
  const [devisUploadEnCours, setDevisUploadEnCours] = useState(false);
  const [devisErreur, setDevisErreur] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  useEffect(() => {
    if (prestation) {
      setStatut(prestation.statut);
      setStatutFacturation(prestation.statut_facturation ?? "a_facturer");
      setPennylaneInvoiceId(prestation.pennylane_invoice_id ?? null);
      setDevisStoragePath(prestation.devis_storage_path ?? null);
      setDevisErreur(null);
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
  const peutJoindreDevis = statut !== "en_attente";

  function handleAttestationSuccess() {
    setStatut("realise");
    setStatutFacturation("a_facturer");
    setSignatureOpen(false);
    router.refresh();
    onClose();
  }

  async function handleDevisSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setDevisErreur("Seuls les fichiers PDF sont acceptés.");
      return;
    }

    setDevisErreur(null);
    setDevisUploadEnCours(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/prestations/${activePrestation.id}/devis`,
        {
          method: "POST",
          body: formData,
        },
      );

      const result = (await response.json()) as {
        success?: boolean;
        devis_storage_path?: string;
        error?: string;
      };

      if (!response.ok || !result.success || !result.devis_storage_path) {
        setDevisErreur(result.error ?? "Impossible de joindre le devis.");
        return;
      }

      setDevisStoragePath(result.devis_storage_path);
      router.refresh();
    } catch {
      setDevisErreur("Impossible de joindre le devis.");
    } finally {
      setDevisUploadEnCours(false);
    }
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-text-muted">Statut</span>
              <Badge variant={getStatutPrestationBadgeVariant(statut)}>
                {getStatutPrestationLabel(statut)}
              </Badge>
              {devisStoragePath && (
                <Badge variant="info">Devis joint</Badge>
              )}
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

            {peutJoindreDevis && (
              <DetailField label="Devis">
                <div className="space-y-2">
                  {devisStoragePath && (
                    <a
                      href={`/api/storage/sign?path=${encodeURIComponent(devisStoragePath)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    >
                      Consulter le devis
                    </a>
                  )}
                  <div>
                    <input
                      ref={devisInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(event) => void handleDevisSelected(event)}
                    />
                    <button
                      type="button"
                      disabled={devisUploadEnCours}
                      onClick={() => devisInputRef.current?.click()}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-strong transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {devisUploadEnCours
                        ? "Envoi…"
                        : devisStoragePath
                          ? "Remplacer le devis"
                          : "Joindre un devis"}
                    </button>
                  </div>
                  {devisErreur && (
                    <p className="text-sm text-[#DC2626]">{devisErreur}</p>
                  )}
                </div>
              </DetailField>
            )}

            {statut === "realise" && (
              <PrestationFacturationForm
                prestationId={activePrestation.id}
                statutFacturation={statutFacturation}
                pennylaneInvoiceId={pennylaneInvoiceId}
                nomClient={getNomCompletMajeur(activePrestation.majeurs)}
                dateApprox={
                  activePrestation.date_acceptee ||
                  activePrestation.date_souhaitee ||
                  activePrestation.created_at ||
                  ""
                }
                onUpdated={({
                  statutFacturation: nextStatut,
                  pennylaneInvoiceId: nextInvoiceId,
                }) => {
                  setStatutFacturation(nextStatut);
                  setPennylaneInvoiceId(nextInvoiceId);
                }}
              />
            )}
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
            {canManageStatut && (
              <PrestationActions
                prestationId={activePrestation.id}
                statut={statut}
                layout="modal"
                onStatutUpdated={setStatut}
                onMarquerRealisee={() => setSignatureOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {canManageStatut && (
        <SignatureModal
          open={signatureOpen}
          prestationId={activePrestation.id}
          onClose={() => setSignatureOpen(false)}
          onSuccess={handleAttestationSuccess}
        />
      )}
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
