"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getAdminNomComplet } from "@/lib/admin/utils";
import type { AdminUser } from "@/types/admin";

const inputClassName =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const labelClassName = "mb-1.5 block text-xs font-medium text-text-muted";

interface AddCongeModalProps {
  open: boolean;
  teamMembers: AdminUser[];
  defaultAdminUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCongeModal({
  open,
  teamMembers,
  defaultAdminUserId,
  onClose,
  onSuccess,
}: AddCongeModalProps) {
  const [adminUserId, setAdminUserId] = useState(defaultAdminUserId);
  const [titre, setTitre] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [notes, setNotes] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const activeMembers = useMemo(
    () => teamMembers.filter((member) => member.actif),
    [teamMembers],
  );

  useEffect(() => {
    if (!open) {
      setAdminUserId(defaultAdminUserId);
      setTitre("");
      setDateDebut("");
      setDateFin("");
      setNotes("");
      setErreur(null);
      return;
    }

    const defaultMember = activeMembers.some(
      (member) => member.id === defaultAdminUserId,
    )
      ? defaultAdminUserId
      : (activeMembers[0]?.id ?? "");

    setAdminUserId(defaultMember);

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
  }, [open, enCours, onClose, defaultAdminUserId, activeMembers]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);

    const titreTrimmed = titre.trim();

    if (!titreTrimmed) {
      setErreur("Le titre est obligatoire.");
      return;
    }

    if (!dateDebut || !dateFin) {
      setErreur("Les dates de début et de fin sont obligatoires.");
      return;
    }

    if (dateFin < dateDebut) {
      setErreur("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }

    if (!adminUserId) {
      setErreur("Veuillez sélectionner un membre de l'équipe.");
      return;
    }

    setEnCours(true);

    const response = await fetch("/api/conges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titre: titreTrimmed,
        date_debut: dateDebut,
        date_fin: dateFin,
        notes,
        admin_user_id: adminUserId,
      }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      setErreur(result.error ?? "Impossible d'ajouter le congé.");
      setEnCours(false);
      return;
    }

    onSuccess();
    onClose();
    setEnCours(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-conge-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={() => !enCours && onClose()}
        aria-label="Fermer la modale"
      />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
          <h2
            id="add-conge-titre"
            className="text-lg font-medium text-text-strong"
          >
            Ajouter un congé
          </h2>
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

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4">
          <div>
            <label htmlFor="conge-membre" className={labelClassName}>
              Membre de l&apos;équipe <span className="text-[#DC2626]">*</span>
            </label>
            <select
              id="conge-membre"
              value={adminUserId}
              onChange={(event) => setAdminUserId(event.target.value)}
              required
              disabled={enCours || activeMembers.length === 0}
              className={inputClassName}
            >
              {activeMembers.length === 0 ? (
                <option value="">Aucun membre actif</option>
              ) : (
                activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {getAdminNomComplet(member)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="conge-titre" className={labelClassName}>
              Titre <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="conge-titre"
              type="text"
              value={titre}
              onChange={(event) => setTitre(event.target.value)}
              required
              disabled={enCours}
              className={inputClassName}
              placeholder="Congés annuels"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="conge-debut" className={labelClassName}>
                Date de début <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="conge-debut"
                type="date"
                value={dateDebut}
                onChange={(event) => setDateDebut(event.target.value)}
                required
                disabled={enCours}
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="conge-fin" className={labelClassName}>
                Date de fin <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="conge-fin"
                type="date"
                value={dateFin}
                onChange={(event) => setDateFin(event.target.value)}
                required
                disabled={enCours}
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <label htmlFor="conge-notes" className={labelClassName}>
              Notes
            </label>
            <textarea
              id="conge-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={enCours}
              rows={3}
              className={inputClassName}
              placeholder="Informations complémentaires…"
            />
          </div>

          {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Enregistrement…" : "Ajouter le congé"}
          </button>
        </form>
      </div>
    </div>
  );
}
