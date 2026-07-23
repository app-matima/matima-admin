"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getSuggestionsFacturesPennylane,
  refreshStatutFacturationPrestation,
  setPennylaneInvoiceId,
} from "@/lib/prestations/actions";
import {
  getStatutFacturation,
  getStatutFacturationBadgeVariant,
  getStatutFacturationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage } from "@/lib/utils/date";
import { Badge } from "@/components/shared/badge";
import type { FacturePennylaneSuggestion } from "@/lib/pennylane/client";
import type { StatutFacturation } from "@/types";

interface PrestationFacturationFormProps {
  prestationId: string;
  statutFacturation: StatutFacturation | null | undefined;
  pennylaneInvoiceId: string | null | undefined;
  nomClient: string;
  dateApprox: string;
  montantApprox?: number | null;
  onUpdated?: (payload: {
    statutFacturation: StatutFacturation;
    pennylaneInvoiceId: string;
  }) => void;
}

function formatMontant(montant: number | null): string {
  if (montant == null) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(montant);
}

export function PrestationFacturationForm({
  prestationId,
  statutFacturation,
  pennylaneInvoiceId,
  nomClient,
  dateApprox,
  montantApprox = null,
  onUpdated,
}: PrestationFacturationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [invoiceId, setInvoiceId] = useState(pennylaneInvoiceId ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [statutLocal, setStatutLocal] = useState(
    getStatutFacturation(statutFacturation),
  );
  const [suggestions, setSuggestions] = useState<FacturePennylaneSuggestion[]>(
    [],
  );
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const hasInvoiceLinked = Boolean(pennylaneInvoiceId?.trim());
  const refreshedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setInvoiceId(pennylaneInvoiceId ?? "");
    setStatutLocal(getStatutFacturation(statutFacturation));
    setErreur(null);
  }, [pennylaneInvoiceId, statutFacturation, prestationId]);

  useEffect(() => {
    const invoiceRef = pennylaneInvoiceId?.trim();
    if (!invoiceRef) {
      return;
    }

    if (getStatutFacturation(statutFacturation) === "payee") {
      return;
    }

    const linkedInvoiceId = invoiceRef;
    const refreshKey = `${prestationId}:${linkedInvoiceId}`;
    if (refreshedKeyRef.current === refreshKey) {
      return;
    }
    refreshedKeyRef.current = refreshKey;

    let cancelled = false;

    async function refreshStatut() {
      const result = await refreshStatutFacturationPrestation(prestationId);

      if (cancelled || !result.success || !result.statutFacturation) {
        return;
      }

      setStatutLocal(result.statutFacturation);

      if (result.updated) {
        onUpdated?.({
          statutFacturation: result.statutFacturation,
          pennylaneInvoiceId: linkedInvoiceId,
        });
        router.refresh();
      }
    }

    void refreshStatut();

    return () => {
      cancelled = true;
    };
    // Refresh une seule fois par ouverture (prestation + facture), via refreshedKeyRef
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot refresh on open
  }, [prestationId, pennylaneInvoiceId, router]);

  useEffect(() => {
    const clientOk = nomClient.trim() && nomClient.trim() !== "—";
    const dateOk = Boolean(dateApprox.trim());

    if (hasInvoiceLinked || !clientOk || !dateOk) {
      setSuggestions([]);
      setSuggestionsError(null);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSuggestions() {
      setSuggestionsLoading(true);
      setSuggestionsError(null);

      const result = await getSuggestionsFacturesPennylane({
        nomClient,
        montantApprox,
        dateApprox,
      });

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setSuggestions([]);
        setSuggestionsError(
          result.error ?? "Impossible de charger les suggestions.",
        );
        setSuggestionsLoading(false);
        return;
      }

      setSuggestions(result.suggestions ?? []);
      setSuggestionsLoading(false);
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [
    hasInvoiceLinked,
    nomClient,
    dateApprox,
    montantApprox,
    prestationId,
  ]);

  function lierFacture(reference: string) {
    setErreur(null);

    startTransition(async () => {
      const result = await setPennylaneInvoiceId(prestationId, reference);

      if (!result.success) {
        setErreur(result.error ?? "Impossible d'enregistrer la référence.");
        return;
      }

      const trimmed = reference.trim();
      setInvoiceId(trimmed);
      setStatutLocal("facture_envoyee");
      setSuggestions([]);
      onUpdated?.({
        statutFacturation: "facture_envoyee",
        pennylaneInvoiceId: trimmed,
      });
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    lierFacture(invoiceId);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-page p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Facturation</span>
        <Badge variant={getStatutFacturationBadgeVariant(statutLocal)}>
          {getStatutFacturationLabel(statutLocal)}
        </Badge>
      </div>

      {pennylaneInvoiceId?.trim() && (
        <p className="text-sm text-text-strong">
          Réf. Pennylane :{" "}
          <span className="font-medium">{pennylaneInvoiceId.trim()}</span>
        </p>
      )}

      {!hasInvoiceLinked && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-muted">
            Suggestions Pennylane
          </p>

          {suggestionsLoading && (
            <p className="text-sm text-text-muted">Recherche en cours…</p>
          )}

          {!suggestionsLoading && suggestionsError && (
            <p className="text-sm text-[#DC2626]">{suggestionsError}</p>
          )}

          {!suggestionsLoading &&
            !suggestionsError &&
            suggestions.length === 0 && (
              <p className="text-sm text-text-muted">
                Aucune facture correspondante trouvée. Saisissez la référence
                manuellement.
              </p>
            )}

          {!suggestionsLoading && suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => lierFacture(suggestion.id)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-accent hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-strong">
                        {suggestion.invoiceNumber}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {suggestion.nomClient}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-text-strong">
                        {formatMontant(suggestion.montant)}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {formatDateAffichage(suggestion.date)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-accent">
                    Cliquer pour lier cette facture
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor={`pennylane-invoice-${prestationId}`}
            className="mb-1.5 block text-xs font-medium text-text-muted"
          >
            {hasInvoiceLinked
              ? "Référence facture Pennylane"
              : "Ou saisir manuellement"}
          </label>
          <input
            id={`pennylane-invoice-${prestationId}`}
            type="text"
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
            disabled={isPending}
            placeholder="ID ou numéro de facture"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
          />
        </div>

        {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}

        <button
          type="submit"
          disabled={isPending || !invoiceId.trim()}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isPending
            ? "Enregistrement…"
            : pennylaneInvoiceId?.trim()
              ? "Mettre à jour la référence"
              : "Enregistrer la facture"}
        </button>
      </form>
    </div>
  );
}
