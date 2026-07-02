"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import {
  formatHeureSouhaitee,
  getNomMajeur,
  getNomOrganisation,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage } from "@/lib/utils/date";
import { getAdminUserLabel } from "@/lib/admin/utils";
import type { AdminUser } from "@/types/admin";
import type { PlanningPrestation } from "@/types/planning";

const inputClassName =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

interface PrestationPlanningModalProps {
  prestation: PlanningPrestation | null;
  teamMembers: AdminUser[];
  onClose: () => void;
  onUpdated: () => void;
}

export function PrestationPlanningModal({
  prestation,
  teamMembers,
  onClose,
  onUpdated,
}: PrestationPlanningModalProps) {
  const [dateAcceptee, setDateAcceptee] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!prestation) {
      setDateAcceptee("");
      setErreur(null);
      return;
    }

    setDateAcceptee(prestation.date_acceptee?.split("T")[0] ?? "");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !enCours) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [prestation, onClose, enCours]);

  if (!prestation) {
    return null;
  }

  const activePrestation = prestation;
  const peutSaisirDate = !activePrestation.date_acceptee;

  async function handleSaveDate(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);

    if (!dateAcceptee.trim()) {
      setErreur("Veuillez sélectionner une date.");
      return;
    }

    setEnCours(true);

    const response = await fetch(`/api/prestations/${activePrestation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date_acceptee: dateAcceptee }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      setErreur(result.error ?? "Impossible d'enregistrer la date.");
      setEnCours(false);
      return;
    }

    onUpdated();
    onClose();
    setEnCours(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prestation-planning-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={() => !enCours && onClose()}
        aria-label="Fermer la modale"
      />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
          <div className="min-w-0">
            <h2
              id="prestation-planning-titre"
              className="text-lg font-medium text-text-strong"
            >
              Prestation
            </h2>
            <p className="mt-0.5 truncate text-sm text-text-muted">
              {getNomMajeur(activePrestation.majeurs)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enCours}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Statut</span>
            <Badge variant={getStatutPrestationBadgeVariant(activePrestation.statut)}>
              {getStatutPrestationLabel(activePrestation.statut)}
            </Badge>
          </div>

          <DetailField label="Cabinet">
            {getNomOrganisation(activePrestation.organisations)}
          </DetailField>

          <DetailField label="Prestataire assigné">
            {getAdminUserLabel(activePrestation.prestataire_id, teamMembers)}
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

          <DetailField label="Date acceptée">
            {activePrestation.date_acceptee
              ? formatDateAffichage(activePrestation.date_acceptee)
              : "Non définie"}
          </DetailField>

          {peutSaisirDate && (
            <form onSubmit={handleSaveDate} className="space-y-3 rounded-lg border border-border bg-page p-4">
              <p className="text-sm font-medium text-text-strong">
                Définir la date acceptée
              </p>
              <input
                type="date"
                value={dateAcceptee}
                onChange={(event) => setDateAcceptee(event.target.value)}
                disabled={enCours}
                required
                className={inputClassName}
              />
              {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
              <button
                type="submit"
                disabled={enCours}
                className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enCours ? "Enregistrement…" : "Enregistrer la date"}
              </button>
            </form>
          )}

          {!peutSaisirDate && erreur && (
            <p className="text-sm text-[#DC2626]">{erreur}</p>
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
