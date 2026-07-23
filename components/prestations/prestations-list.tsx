"use client";

import { useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { PrestationDetailModal } from "@/components/prestations/prestation-detail-modal";
import {
  filtrerPrestations,
  filtresPrestation,
  formatHeureSouhaitee,
  getNomMajeur,
  getNomOrganisation,
  getStatutFacturationBadgeVariant,
  getStatutFacturationLabel,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
  type FiltrePrestation,
} from "@/lib/prestations/utils";
import { formatDateAffichage, truncateText } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { PrestationAvecRelations } from "@/types";

interface PrestationsListProps {
  prestations: PrestationAvecRelations[];
}

export function PrestationsList({ prestations }: PrestationsListProps) {
  const [filtre, setFiltre] = useState<FiltrePrestation>("toutes");
  const [selectedPrestation, setSelectedPrestation] =
    useState<PrestationAvecRelations | null>(null);

  const prestationsFiltrees = useMemo(
    () => filtrerPrestations(prestations, filtre),
    [prestations, filtre],
  );

  return (
    <>
      <div className="space-y-4">
        <select
          value={filtre}
          onChange={(event) =>
            setFiltre(event.target.value as FiltrePrestation)
          }
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:hidden"
          aria-label="Filtrer par statut"
        >
          {filtresPrestation.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="hidden gap-2 md:flex md:flex-wrap">
          {filtresPrestation.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFiltre(option.id)}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                filtre === option.id
                  ? "bg-accent text-white"
                  : "border border-border bg-card text-text-muted hover:bg-page hover:text-text-strong",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {prestationsFiltrees.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
                <Briefcase className="h-6 w-6 text-[#9CA3AF]" />
              </div>
              <p className="mb-1 text-sm font-medium text-text-strong">
                Aucune prestation pour ce filtre
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Essayez un autre filtre ou consultez toutes les prestations
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 lg:hidden">
              {prestationsFiltrees.map((prestation) => (
                <button
                  key={prestation.id}
                  type="button"
                  onClick={() => setSelectedPrestation(prestation)}
                  className="w-full space-y-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-page"
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
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge
                        variant={getStatutPrestationBadgeVariant(
                          prestation.statut,
                        )}
                      >
                        {getStatutPrestationLabel(prestation.statut)}
                      </Badge>
                      {prestation.statut === "realise" && (
                        <Badge
                          variant={getStatutFacturationBadgeVariant(
                            prestation.statut_facturation,
                          )}
                        >
                          {getStatutFacturationLabel(
                            prestation.statut_facturation,
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-text-muted line-clamp-2">
                    {truncateText(prestation.description, 120)}
                  </p>

                  <div className="flex flex-wrap gap-3 text-xs text-[#9CA3AF]">
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

            <div className="hidden overflow-x-auto rounded-xl border border-border bg-card lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-page">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Protégé
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Cabinet
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Heure
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Adresse
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Facturation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {prestationsFiltrees.map((prestation) => (
                    <tr
                      key={prestation.id}
                      onClick={() => setSelectedPrestation(prestation)}
                      className="cursor-pointer border-b border-border align-top transition-colors hover:bg-page"
                    >
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {getNomMajeur(prestation.majeurs)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {getNomOrganisation(prestation.organisations)}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-sm text-text-muted">
                        <span className="line-clamp-2">
                          {prestation.description}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {formatDateAffichage(prestation.date_souhaitee)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {formatHeureSouhaitee(prestation.heure_souhaitee)}
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-sm text-text-muted">
                        <span className="line-clamp-2">
                          {prestation.adresse_intervention?.trim() || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={getStatutPrestationBadgeVariant(
                            prestation.statut,
                          )}
                        >
                          {getStatutPrestationLabel(prestation.statut)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {prestation.statut === "realise" ? (
                          <Badge
                            variant={getStatutFacturationBadgeVariant(
                              prestation.statut_facturation,
                            )}
                          >
                            {getStatutFacturationLabel(
                              prestation.statut_facturation,
                            )}
                          </Badge>
                        ) : (
                          <span className="text-sm text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <PrestationDetailModal
        prestation={selectedPrestation}
        onClose={() => setSelectedPrestation(null)}
      />
    </>
  );
}
