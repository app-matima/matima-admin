"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { fetchClientDetail } from "@/lib/clients/actions";
import {
  getMjpmNomComplet,
  getStatutMajeurBadgeVariant,
  getStatutMajeurLabel,
} from "@/lib/clients/utils";
import {
  getNomMajeur,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage } from "@/lib/utils/date";
import { statutsMajeurModal } from "@/types/clients";
import type { ClientListItem } from "@/types/clients";

interface ClientDetailModalProps {
  client: ClientListItem | null;
  onClose: () => void;
}

export function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<
    Awaited<ReturnType<typeof fetchClientDetail>>
  >(null);

  useEffect(() => {
    if (!client) {
      setDetail(null);
      setErreur(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErreur(null);

    void fetchClientDetail(client.organisationId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result) {
        setErreur("Impossible de charger le détail du client.");
        setDetail(null);
      } else {
        setDetail(result);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
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
  }, [client, onClose]);

  if (!client) {
    return null;
  }

  const mjpm = detail?.mjpm ?? client.mjpm;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-detail-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={onClose}
        aria-label="Fermer la modale"
      />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2
              id="client-detail-titre"
              className="text-lg font-medium text-text-strong"
            >
              {getMjpmNomComplet(mjpm)}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {mjpm?.email ?? "—"}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Inscrit le {formatDateAffichage(client.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-1/3 rounded bg-page" />
              <div className="h-20 rounded bg-page" />
              <div className="h-24 rounded bg-page" />
            </div>
          ) : erreur ? (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
              <p className="text-sm text-[#991B1B]">{erreur}</p>
            </div>
          ) : detail ? (
            <>
              <section className="grid grid-cols-3 gap-3">
                {statutsMajeurModal.map((statut) => (
                  <div
                    key={statut}
                    className="rounded-xl border border-border bg-page p-3"
                  >
                    <p className="mb-2 text-xs text-text-muted">
                      {getStatutMajeurLabel(statut)}
                    </p>
                    <Badge variant={getStatutMajeurBadgeVariant(statut)}>
                      {detail.protegesParStatut[statut]}
                    </Badge>
                  </div>
                ))}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-medium text-text-strong">
                  5 dernières prestations
                </h3>
                {detail.dernieresPrestations.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    Aucune prestation pour ce cabinet.
                  </p>
                ) : (
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {detail.dernieresPrestations.map((prestation) => (
                      <div key={prestation.id} className="space-y-2 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium text-text-strong">
                            {getNomMajeur(prestation.majeurs)}
                          </p>
                          <Badge
                            variant={getStatutPrestationBadgeVariant(
                              prestation.statut,
                            )}
                          >
                            {getStatutPrestationLabel(prestation.statut)}
                          </Badge>
                        </div>
                        <p className="text-sm text-text-muted">
                          {prestation.description}
                        </p>
                        <p className="text-xs text-[#9CA3AF]">
                          {formatDateAffichage(prestation.date_souhaitee)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
