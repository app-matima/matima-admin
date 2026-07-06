"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { marquerCourrierEnvoye } from "@/lib/courriers/actions";
import {
  formatPrixFacture,
  getStatutCourrierBadgeVariant,
  getStatutCourrierLabel,
  getTypeEnvoiBadgeVariant,
  getTypeEnvoiLabel,
} from "@/lib/courriers/utils";
import {
  getNomMajeur,
  getNomOrganisation,
} from "@/lib/prestations/utils";
import { formatDateTimeAffichage } from "@/lib/utils/date";
import type { CourrierAvecRelations, StatutCourrier } from "@/types/courriers";

interface CourrierDetailModalProps {
  courrier: CourrierAvecRelations | null;
  onClose: () => void;
}

export function CourrierDetailModal({
  courrier,
  onClose,
}: CourrierDetailModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statut, setStatut] = useState<StatutCourrier | null>(null);
  const [envoyeAt, setEnvoyeAt] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (courrier) {
      setStatut(courrier.statut);
      setEnvoyeAt(courrier.envoye_at);
      setErreur(null);
    }
  }, [courrier]);

  useEffect(() => {
    if (!courrier) {
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
  }, [courrier, onClose]);

  if (!courrier || !statut) {
    return null;
  }

  const activeCourrier = courrier;
  const pdfUrl = `/api/storage/sign?path=${encodeURIComponent(activeCourrier.storage_path)}`;

  function handleMarquerEnvoye() {
    setErreur(null);

    startTransition(async () => {
      const result = await marquerCourrierEnvoye(activeCourrier.id);
      if (!result.success) {
        setErreur(result.error ?? "Impossible de mettre à jour le courrier.");
        return;
      }

      const now = new Date().toISOString();
      setStatut("envoye");
      setEnvoyeAt(now);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="courrier-detail-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={onClose}
        aria-label="Fermer la modale"
      />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:max-h-[90vh] sm:max-w-4xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2
              id="courrier-detail-titre"
              className="text-lg font-medium text-text-strong"
            >
              Détail du courrier
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {getNomMajeur(activeCourrier.majeurs)} — {activeCourrier.destinataire_nom}
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

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-border bg-page p-4">
            <iframe
              src={pdfUrl}
              title={`Aperçu du courrier pour ${activeCourrier.destinataire_nom}`}
              className="h-56 w-full rounded-lg border border-border bg-white sm:h-80"
            />
          </div>

          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatutCourrierBadgeVariant(statut)}>
                {getStatutCourrierLabel(statut)}
              </Badge>
              <Badge variant={getTypeEnvoiBadgeVariant(activeCourrier.type_envoi)}>
                {getTypeEnvoiLabel(activeCourrier.type_envoi)}
              </Badge>
            </div>

            <DetailField label="Protégé">
              {getNomMajeur(activeCourrier.majeurs)}
            </DetailField>

            <DetailField label="Cabinet MJPM">
              {getNomOrganisation(activeCourrier.organisations)}
            </DetailField>

            <DetailField label="Destinataire">
              {activeCourrier.destinataire_nom}
            </DetailField>

            <DetailField label="Adresse">
              <p className="whitespace-pre-wrap">
                {activeCourrier.destinataire_adresse?.trim() || "—"}
              </p>
            </DetailField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DetailField label="Pages">
                {activeCourrier.nombre_pages}
              </DetailField>
              <DetailField label="Prix facturé">
                {formatPrixFacture(activeCourrier.prix_facture)}
              </DetailField>
              <DetailField label="Type d'envoi">
                {getTypeEnvoiLabel(activeCourrier.type_envoi)}
              </DetailField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailField label="Créé le">
                {formatDateTimeAffichage(activeCourrier.created_at)}
              </DetailField>
              <DetailField label="Envoyé le">
                {formatDateTimeAffichage(envoyeAt)}
              </DetailField>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          {erreur && (
            <p className="text-sm text-[#991B1B]" role="alert">
              {erreur}
            </p>
          )}

          {statut === "en_attente" && (
            <button
              type="button"
              onClick={handleMarquerEnvoye}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isPending ? "Mise à jour…" : "Marquer comme envoyé"}
            </button>
          )}
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
