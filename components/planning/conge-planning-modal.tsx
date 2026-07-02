"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { getAdminUserLabel } from "@/lib/admin/utils";
import { formatDateAffichage } from "@/lib/utils/date";
import type { AdminUser } from "@/types/admin";
import type { Conge } from "@/types/planning";

interface CongePlanningModalProps {
  conge: Conge | null;
  teamMembers: AdminUser[];
  onClose: () => void;
}

export function CongePlanningModal({
  conge,
  teamMembers,
  onClose,
}: CongePlanningModalProps) {
  useEffect(() => {
    if (!conge) {
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
  }, [conge, onClose]);

  if (!conge) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conge-planning-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={onClose}
        aria-label="Fermer la modale"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-t-xl border border-border bg-card sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2
            id="conge-planning-titre"
            className="text-lg font-medium text-text-strong"
          >
            {conge.titre}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <DetailField label="Membre">
            {getAdminUserLabel(conge.admin_user_id, teamMembers)}
          </DetailField>
          <DetailField label="Date de début">
            {formatDateAffichage(conge.date_debut)}
          </DetailField>
          <DetailField label="Date de fin">
            {formatDateAffichage(conge.date_fin)}
          </DetailField>
          <DetailField label="Notes">
            <p className="whitespace-pre-wrap">
              {conge.notes?.trim() || "—"}
            </p>
          </DetailField>
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
