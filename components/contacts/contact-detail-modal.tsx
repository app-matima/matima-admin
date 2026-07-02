"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import {
  formatContactValeur,
  getContactNomComplet,
} from "@/lib/contacts/utils";
import type { ContactInterne } from "@/types/contacts";

interface ContactDetailModalProps {
  contact: ContactInterne | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (contact: ContactInterne) => void;
  onDeleted: () => void;
}

const deleteButtonClassName =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#FECACA] bg-transparent px-4 py-2.5 text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

const editButtonClassName =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto";

function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      {href && value !== "—" ? (
        <a
          href={href}
          className="mt-0.5 block text-sm text-accent hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="mt-0.5 text-sm text-text-strong">{value}</p>
      )}
    </div>
  );
}

export function ContactDetailModal({
  contact,
  isAdmin,
  onClose,
  onEdit,
  onDeleted,
}: ContactDetailModalProps) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  useEffect(() => {
    if (!contact) {
      setErreur(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !suppressionEnCours) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [contact, onClose, suppressionEnCours]);

  if (!contact) {
    return null;
  }

  const activeContact = contact;

  async function handleDelete() {
    const confirme = window.confirm(
      `Supprimer ${getContactNomComplet(activeContact)} ? Cette action est irréversible.`,
    );

    if (!confirme) {
      return;
    }

    setErreur(null);
    setSuppressionEnCours(true);

    const response = await fetch(`/api/contacts/${activeContact.id}`, {
      method: "DELETE",
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      setErreur(result.error ?? "Impossible de supprimer ce contact.");
      setSuppressionEnCours(false);
      return;
    }

    onDeleted();
    onClose();
    setSuppressionEnCours(false);
  }

  const email = formatContactValeur(activeContact.email);
  const telephone = formatContactValeur(activeContact.telephone);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-detail-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={() => !suppressionEnCours && onClose()}
        aria-label="Fermer la modale"
      />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
          <h2
            id="contact-detail-titre"
            className="text-lg font-medium text-text-strong"
          >
            {getContactNomComplet(activeContact)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={suppressionEnCours}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <DetailRow label="Nom" value={formatContactValeur(activeContact.nom)} />
          <DetailRow label="Prénom" value={formatContactValeur(activeContact.prenom)} />
          <DetailRow
            label="Entreprise"
            value={formatContactValeur(activeContact.entreprise)}
          />
          <DetailRow
            label="Téléphone"
            value={telephone}
            href={telephone !== "—" ? `tel:${telephone.replace(/\s/g, "")}` : undefined}
          />
          <DetailRow
            label="Email"
            value={email}
            href={email !== "—" ? `mailto:${email}` : undefined}
          />
          <DetailRow label="Rôle" value={formatContactValeur(activeContact.role)} />
          <div>
            <p className="text-xs font-medium text-text-muted">Notes</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-strong">
              {formatContactValeur(activeContact.notes)}
            </p>
          </div>

          {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
        </div>

        {isAdmin && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={suppressionEnCours}
              className={deleteButtonClassName}
            >
              <Trash2 className="h-4 w-4" />
              {suppressionEnCours ? "Suppression…" : "Supprimer"}
            </button>
            <button
              type="button"
              onClick={() => onEdit(activeContact)}
              disabled={suppressionEnCours}
              className={editButtonClassName}
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
