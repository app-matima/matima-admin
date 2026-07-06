"use client";

import { useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { CourrierDetailModal } from "@/components/courriers/courrier-detail-modal";
import {
  filtrerCourriers,
  filtresCourrier,
  formatPrixFacture,
  getStatutCourrierBadgeVariant,
  getStatutCourrierLabel,
  getTypeEnvoiBadgeVariant,
  getTypeEnvoiLabel,
  type FiltreCourrier,
} from "@/lib/courriers/utils";
import {
  getNomMajeur,
  getNomOrganisation,
} from "@/lib/prestations/utils";
import { truncateText } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { CourrierAvecRelations } from "@/types/courriers";

interface CourriersListProps {
  courriers: CourrierAvecRelations[];
}

export function CourriersList({ courriers }: CourriersListProps) {
  const [filtre, setFiltre] = useState<FiltreCourrier>("tous");
  const [selectedCourrier, setSelectedCourrier] =
    useState<CourrierAvecRelations | null>(null);

  const courriersFiltres = useMemo(
    () => filtrerCourriers(courriers, filtre),
    [courriers, filtre],
  );

  return (
    <>
      <div className="space-y-4">
        <select
          value={filtre}
          onChange={(event) =>
            setFiltre(event.target.value as FiltreCourrier)
          }
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:hidden"
          aria-label="Filtrer par statut"
        >
          {filtresCourrier.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="hidden gap-2 md:flex md:flex-wrap">
          {filtresCourrier.map((option) => (
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

        {courriersFiltres.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
                <Mail className="h-6 w-6 text-[#9CA3AF]" />
              </div>
              <p className="mb-1 text-sm font-medium text-text-strong">
                Aucun courrier pour ce filtre
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Essayez un autre filtre ou consultez tous les courriers
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 lg:hidden">
              {courriersFiltres.map((courrier) => (
                <button
                  key={courrier.id}
                  type="button"
                  onClick={() => setSelectedCourrier(courrier)}
                  className="w-full space-y-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-page"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-strong">
                        {getNomMajeur(courrier.majeurs)}
                      </p>
                      <p className="text-xs text-text-muted">
                        {getNomOrganisation(courrier.organisations)}
                      </p>
                    </div>
                    <Badge
                      variant={getStatutCourrierBadgeVariant(courrier.statut)}
                    >
                      {getStatutCourrierLabel(courrier.statut)}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-text-strong">
                      {courrier.destinataire_nom}
                    </p>
                    <p className="text-xs text-text-muted line-clamp-2">
                      {courrier.destinataire_adresse?.trim() || "—"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getTypeEnvoiBadgeVariant(courrier.type_envoi)}>
                      {getTypeEnvoiLabel(courrier.type_envoi)}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {courrier.nombre_pages} p.
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatPrixFacture(courrier.prix_facture)}
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
                      Destinataire
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Adresse
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Pages
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Prix
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courriersFiltres.map((courrier) => (
                    <tr
                      key={courrier.id}
                      onClick={() => setSelectedCourrier(courrier)}
                      className="cursor-pointer border-b border-border align-top transition-colors hover:bg-page"
                    >
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {getNomMajeur(courrier.majeurs)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {getNomOrganisation(courrier.organisations)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {courrier.destinataire_nom}
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-sm text-text-muted">
                        <span className="line-clamp-2">
                          {truncateText(
                            courrier.destinataire_adresse?.trim() || "—",
                            80,
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={getTypeEnvoiBadgeVariant(courrier.type_envoi)}
                        >
                          {getTypeEnvoiLabel(courrier.type_envoi)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {courrier.nombre_pages}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {formatPrixFacture(courrier.prix_facture)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={getStatutCourrierBadgeVariant(courrier.statut)}
                        >
                          {getStatutCourrierLabel(courrier.statut)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CourrierDetailModal
        courrier={selectedCourrier}
        onClose={() => setSelectedCourrier(null)}
      />
    </>
  );
}
