"use client";

import { useState } from "react";
import { Badge } from "@/components/shared/badge";
import {
  getAdminNomComplet,
  getAdminRoleBadgeVariant,
  getAdminRoleLabel,
} from "@/lib/admin/utils";
import { createClient } from "@/lib/supabase/client";
import type { AdminUser } from "@/types/admin";

interface MonCompteSectionProps {
  user: AdminUser;
}

const inputClassName =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const labelClassName = "mb-1.5 block text-xs font-medium text-text-muted";

export function MonCompteSection({ user }: MonCompteSectionProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    setSucces(null);

    if (password.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmation) {
      setErreur("Les mots de passe ne correspondent pas.");
      return;
    }

    setEnCours(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErreur(error.message);
      setEnCours(false);
      return;
    }

    setPassword("");
    setConfirmation("");
    setSucces("Mot de passe mis à jour.");
    setEnCours(false);
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-medium text-text-strong">Mon compte</h2>
      </div>

      <div className="space-y-6 p-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className={labelClassName}>Nom complet</dt>
            <dd className="text-sm text-text-strong">
              {getAdminNomComplet(user)}
            </dd>
          </div>
          <div>
            <dt className={labelClassName}>Email</dt>
            <dd className="text-sm text-text-strong">{user.email}</dd>
          </div>
          <div>
            <dt className={labelClassName}>Rôle</dt>
            <dd>
              <Badge variant={getAdminRoleBadgeVariant(user.role)}>
                {getAdminRoleLabel(user.role)}
              </Badge>
            </dd>
          </div>
        </dl>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 border-t border-border pt-6">
          <h3 className="text-sm font-medium text-text-strong">
            Modifier le mot de passe
          </h3>

          <div>
            <label htmlFor="new-password" className={labelClassName}>
              Nouveau mot de passe
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              disabled={enCours}
              autoComplete="new-password"
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className={labelClassName}>
              Confirmer le mot de passe
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              minLength={6}
              disabled={enCours}
              autoComplete="new-password"
              className={inputClassName}
            />
          </div>

          {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
          {succes && (
            <p className="text-sm text-[#00796B]">{succes}</p>
          )}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-4"
          >
            {enCours ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </div>
    </section>
  );
}
