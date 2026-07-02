"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { inviteAdminUser } from "@/lib/admin/actions";
import type { AdminRole } from "@/types/admin";

interface InviteAdminModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputClassName =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const labelClassName = "mb-1.5 block text-xs font-medium text-text-muted";

export function InviteAdminModal({
  open,
  onClose,
  onSuccess,
}: InviteAdminModalProps) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("prestataire");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrenom("");
      setNom("");
      setEmail("");
      setRole("prestataire");
      setErreur(null);
      return;
    }

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
  }, [open, enCours, onClose]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);

    const result = await inviteAdminUser({ prenom, nom, email, role });

    if (!result.success) {
      setErreur(result.error ?? "Impossible d'envoyer l'invitation.");
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
      aria-labelledby="invite-admin-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={() => !enCours && onClose()}
        aria-label="Fermer la modale"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-t-xl border border-border bg-card sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2
            id="invite-admin-titre"
            className="text-lg font-medium text-text-strong"
          >
            Inviter un membre
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

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label htmlFor="invite-prenom" className={labelClassName}>
              Prénom
            </label>
            <input
              id="invite-prenom"
              type="text"
              value={prenom}
              onChange={(event) => setPrenom(event.target.value)}
              required
              disabled={enCours}
              className={inputClassName}
              placeholder="Marie"
            />
          </div>

          <div>
            <label htmlFor="invite-nom" className={labelClassName}>
              Nom
            </label>
            <input
              id="invite-nom"
              type="text"
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              required
              disabled={enCours}
              className={inputClassName}
              placeholder="Dupont"
            />
          </div>

          <div>
            <label htmlFor="invite-email" className={labelClassName}>
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={enCours}
              className={inputClassName}
              placeholder="marie@matima.fr"
            />
          </div>

          <div>
            <label htmlFor="invite-role" className={labelClassName}>
              Rôle
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as AdminRole)}
              disabled={enCours}
              className={inputClassName}
            >
              <option value="admin">Admin</option>
              <option value="prestataire">Prestataire</option>
            </select>
          </div>

          {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Envoi…" : "Envoyer l'invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
