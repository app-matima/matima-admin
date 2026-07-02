"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ContactInterne } from "@/types/contacts";

interface ContactFormModalProps {
  open: boolean;
  contact?: ContactInterne | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const contactInputClassName =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export const contactLabelClassName =
  "mb-1.5 block text-xs font-medium text-text-muted";

export function ContactFormModal({
  open,
  contact,
  onClose,
  onSuccess,
}: ContactFormModalProps) {
  const isEdit = Boolean(contact);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!open) {
      setNom("");
      setPrenom("");
      setEntreprise("");
      setTelephone("");
      setEmail("");
      setRole("");
      setNotes("");
      setErreur(null);
      return;
    }

    if (contact) {
      setNom(contact.nom);
      setPrenom(contact.prenom ?? "");
      setEntreprise(contact.entreprise ?? "");
      setTelephone(contact.telephone ?? "");
      setEmail(contact.email ?? "");
      setRole(contact.role ?? "");
      setNotes(contact.notes ?? "");
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
  }, [open, contact, enCours, onClose]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);

    const nomTrimmed = nom.trim();

    if (!nomTrimmed) {
      setErreur("Le nom est obligatoire.");
      return;
    }

    setEnCours(true);

    const payload = {
      nom: nomTrimmed,
      prenom,
      entreprise,
      telephone,
      email,
      role,
      notes,
    };

    const response = await fetch(
      isEdit && contact ? `/api/contacts/${contact.id}` : "/api/contacts",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      setErreur(result.error ?? "Impossible d'enregistrer le contact.");
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
      aria-labelledby="contact-form-titre"
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
            id="contact-form-titre"
            className="text-lg font-medium text-text-strong"
          >
            {isEdit ? "Modifier le contact" : "Ajouter un contact"}
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

        <form
          onSubmit={handleSubmit}
          className="space-y-4 overflow-y-auto p-4"
        >
          <div>
            <label htmlFor="contact-nom" className={contactLabelClassName}>
              Nom <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="contact-nom"
              type="text"
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              required
              disabled={enCours}
              className={contactInputClassName}
              placeholder="Dupont"
            />
          </div>

          <div>
            <label htmlFor="contact-prenom" className={contactLabelClassName}>
              Prénom
            </label>
            <input
              id="contact-prenom"
              type="text"
              value={prenom}
              onChange={(event) => setPrenom(event.target.value)}
              disabled={enCours}
              className={contactInputClassName}
              placeholder="Marie"
            />
          </div>

          <div>
            <label htmlFor="contact-entreprise" className={contactLabelClassName}>
              Entreprise
            </label>
            <input
              id="contact-entreprise"
              type="text"
              value={entreprise}
              onChange={(event) => setEntreprise(event.target.value)}
              disabled={enCours}
              className={contactInputClassName}
              placeholder="Cabinet Dupont"
            />
          </div>

          <div>
            <label htmlFor="contact-telephone" className={contactLabelClassName}>
              Téléphone
            </label>
            <input
              id="contact-telephone"
              type="tel"
              value={telephone}
              onChange={(event) => setTelephone(event.target.value)}
              disabled={enCours}
              className={contactInputClassName}
              placeholder="06 12 34 56 78"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className={contactLabelClassName}>
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={enCours}
              className={contactInputClassName}
              placeholder="contact@exemple.fr"
            />
          </div>

          <div>
            <label htmlFor="contact-role" className={contactLabelClassName}>
              Rôle
            </label>
            <input
              id="contact-role"
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={enCours}
              className={contactInputClassName}
              placeholder="Notaire, avocat…"
            />
          </div>

          <div>
            <label htmlFor="contact-notes" className={contactLabelClassName}>
              Notes
            </label>
            <textarea
              id="contact-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={enCours}
              rows={3}
              className={contactInputClassName}
              placeholder="Informations complémentaires…"
            />
          </div>

          {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
          </button>
        </form>
      </div>
    </div>
  );
}
