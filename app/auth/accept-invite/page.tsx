"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

function parseHashParams(hash: string): URLSearchParams {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(normalized);
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const params = parseHashParams(window.location.hash);
    const hashError =
      params.get("error_description") ?? params.get("error");

    if (hashError) {
      setError(hashError);
      setExchanging(false);
      return;
    }

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      setError("Lien d'invitation invalide.");
      setExchanging(false);
      return;
    }

    const supabase = createClient();

    void supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error: authError }) => {
        if (authError) {
          setError(authError.message);
          setSessionReady(false);
        } else {
          setSessionReady(true);
          window.history.replaceState(null, "", window.location.pathname);
        }
        setExchanging(false);
      });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-text-strong">Matima Admin</h1>
          <p className="mt-2 text-sm text-text-muted">
            Définissez votre mot de passe
          </p>
        </div>

        {exchanging ? (
          <p className="text-center text-sm text-text-muted">
            Vérification de l&apos;invitation…
          </p>
        ) : !sessionReady ? (
          <p className="text-center text-sm text-[#DC2626]">
            {error ?? "Impossible de valider l'invitation."}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-text-strong"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                className={inputClassName}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-text-strong"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                className={inputClassName}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-[#DC2626]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Enregistrement…" : "Activer mon compte"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
