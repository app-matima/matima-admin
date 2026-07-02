"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          role: "admin",
          prenom: prenom.trim(),
          nom: nom.trim(),
        },
      },
    });

    if (authError) {
      setError(authError.message || JSON.stringify(authError));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-sm border border-border text-center">
          <h1 className="text-2xl font-semibold text-text-strong">
            Compte créé, vous pouvez vous connecter
          </h1>
          <Link
            href="/auth/login"
            className="mt-6 inline-block text-sm font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-sm border border-border">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-text-strong">Matima Admin</h1>
          <p className="mt-2 text-sm text-text-muted">
            Créer un compte administrateur
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prenom"
                className="block text-sm font-medium text-text-strong mb-1.5"
              >
                Prénom
              </label>
              <input
                id="prenom"
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
                autoComplete="given-name"
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="Marie"
              />
            </div>

            <div>
              <label
                htmlFor="nom"
                className="block text-sm font-medium text-text-strong mb-1.5"
              >
                Nom
              </label>
              <input
                id="nom"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                autoComplete="family-name"
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="Dupont"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-strong mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              placeholder="admin@matima.fr"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-strong mb-1.5"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-text-strong mb-1.5"
            >
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Création..." : "Créer un compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Déjà un compte ?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
