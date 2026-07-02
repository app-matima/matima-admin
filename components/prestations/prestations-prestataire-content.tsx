"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ChevronDown } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { PrestataireDetailModal } from "@/components/prestations/prestataire-detail-modal";
import { acceptPrestation } from "@/lib/prestations/actions";
import {
  formatHeureSouhaitee,
  getNomMajeur,
  getNomOrganisation,
  getPrestationsEnAttenteNonAssignees,
  getPrestationsHistorique,
  getPrestationsMesMissions,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage, truncateText } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { PrestationAvecRelations } from "@/types";

interface PrestationsPrestataireContentProps {
  prestations: PrestationAvecRelations[];
  currentUserId: string;
}

export function PrestationsPrestataireContent({
  prestations,
  currentUserId,
}: PrestationsPrestataireContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [selectedPrestation, setSelectedPrestation] =
    useState<PrestationAvecRelations | null>(null);

  const enAttente = useMemo(
    () => getPrestationsEnAttenteNonAssignees(prestations),
    [prestations],
  );
  const mesMissions = useMemo(
    () => getPrestationsMesMissions(prestations, currentUserId),
    [prestations, currentUserId],
  );
  const historique = useMemo(
    () => getPrestationsHistorique(prestations, currentUserId),
    [prestations, currentUserId],
  );

  function handleAccept(prestationId: string) {
    setErreur(null);
    setAcceptingId(prestationId);

    startTransition(async () => {
      const result = await acceptPrestation(prestationId);

      if (!result.success) {
        setErreur(result.error ?? "Impossible d'accepter la prestation.");
        setAcceptingId(null);
        return;
      }

      setAcceptingId(null);
      router.refresh();
    });
  }

  const enChargement = isPending && acceptingId !== null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Prestations
      </h1>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-text-strong">En attente</h2>
            <p className="text-sm text-text-muted">
              Prestations disponibles à prendre en charge
            </p>
          </div>
          {enAttente.length > 0 && (
            <span className="rounded-full bg-[#FFF8E1] px-3 py-1 text-sm font-medium text-[#B45309]">
              {enAttente.length}
            </span>
          )}
        </div>

        {enAttente.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-text-muted">
              Aucune prestation en attente pour le moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {enAttente.map((prestation) => {
              const enCours =
                enChargement && acceptingId === prestation.id;

              return (
                <article
                  key={prestation.id}
                  className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 shadow-sm sm:p-5"
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#B45309]">
                    À prendre en charge
                  </p>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-text-strong">
                          {getNomMajeur(prestation.majeurs)}
                        </p>
                        <p className="text-sm text-text-muted">
                          {getNomOrganisation(prestation.organisations)}
                        </p>
                      </div>
                      <Badge variant="warning">En attente</Badge>
                    </div>

                    <p className="text-sm text-text-strong">
                      {truncateText(prestation.description, 160)}
                    </p>

                    <div className="flex flex-wrap gap-3 text-sm text-text-muted">
                      <span>
                        {formatDateAffichage(prestation.date_souhaitee)}
                      </span>
                      <span>
                        {formatHeureSouhaitee(prestation.heure_souhaitee)}
                      </span>
                      {prestation.adresse_intervention?.trim() && (
                        <span className="w-full sm:w-auto">
                          {truncateText(
                            prestation.adresse_intervention.trim(),
                            80,
                          )}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAccept(prestation.id)}
                      disabled={enChargement}
                      className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[10rem] sm:px-6"
                    >
                      {enCours ? "Acceptation…" : "Accepter"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {erreur && (
          <p className="text-sm text-[#DC2626]">{erreur}</p>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium text-text-strong">Mes missions</h2>
          <p className="text-sm text-text-muted">
            Prestations qui vous sont assignées
          </p>
        </div>

        {mesMissions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-text-muted">
              Vous n&apos;avez pas encore de mission en cours.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {mesMissions.map((prestation) => (
              <button
                key={prestation.id}
                type="button"
                onClick={() => setSelectedPrestation(prestation)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-page sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-strong">
                      {getNomMajeur(prestation.majeurs)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {getNomOrganisation(prestation.organisations)}
                    </p>
                  </div>
                  <Badge
                    variant={getStatutPrestationBadgeVariant(prestation.statut)}
                  >
                    {getStatutPrestationLabel(prestation.statut)}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-text-muted line-clamp-2">
                  {truncateText(prestation.description, 120)}
                </p>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#9CA3AF]">
                  <span>
                    {formatDateAffichage(prestation.date_souhaitee)}
                  </span>
                  <span>
                    {formatHeureSouhaitee(prestation.heure_souhaitee)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {historique.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setHistoriqueOuvert((open) => !open)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div>
              <h2 className="text-base font-medium text-text-strong">
                Historique
              </h2>
              <p className="text-sm text-text-muted">
                Réalisées et annulées ({historique.length})
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-text-muted transition-transform",
                historiqueOuvert && "rotate-180",
              )}
            />
          </button>

          {historiqueOuvert && (
            <div className="space-y-3 border-t border-border p-4">
              {historique.map((prestation) => (
                <button
                  key={prestation.id}
                  type="button"
                  onClick={() => setSelectedPrestation(prestation)}
                  className="w-full rounded-lg border border-border bg-page p-4 text-left transition-colors hover:bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-strong">
                        {getNomMajeur(prestation.majeurs)}
                      </p>
                      <p className="text-xs text-text-muted">
                        {getNomOrganisation(prestation.organisations)}
                      </p>
                    </div>
                    <Badge
                      variant={getStatutPrestationBadgeVariant(
                        prestation.statut,
                      )}
                    >
                      {getStatutPrestationLabel(prestation.statut)}
                    </Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#9CA3AF]">
                    <span>
                      {formatDateAffichage(prestation.date_souhaitee)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {enAttente.length === 0 &&
        mesMissions.length === 0 &&
        historique.length === 0 && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
                <Briefcase className="h-6 w-6 text-[#9CA3AF]" />
              </div>
              <p className="mb-1 text-sm font-medium text-text-strong">
                Aucune prestation
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Les nouvelles demandes apparaîtront ici
              </p>
            </div>
          </div>
        )}

      <PrestataireDetailModal
        prestation={selectedPrestation}
        onClose={() => setSelectedPrestation(null)}
      />
    </div>
  );
}
