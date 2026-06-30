import { Badge } from "@/components/shared/badge";
import {
  getNomMajeur,
  getNomOrganisation,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage, truncateText } from "@/lib/utils/date";
import type { PrestationAvecRelations } from "@/types";

interface DernieresPrestationsProps {
  prestations: PrestationAvecRelations[];
}

export function DernieresPrestations({ prestations }: DernieresPrestationsProps) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-medium text-text-strong">
          Dernières prestations
        </h2>
      </div>

      {prestations.length === 0 ? (
        <p className="p-4 text-sm text-text-muted">
          Aucune prestation pour le moment.
        </p>
      ) : (
        <>
          <div className="divide-y divide-border lg:hidden">
            {prestations.map((prestation) => (
              <div key={prestation.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-text-strong">
                    {getNomMajeur(prestation.majeurs)}
                  </p>
                  <Badge
                    variant={getStatutPrestationBadgeVariant(prestation.statut)}
                  >
                    {getStatutPrestationLabel(prestation.statut)}
                  </Badge>
                </div>
                <p className="text-sm text-text-muted line-clamp-2">
                  {truncateText(prestation.description, 120)}
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  {formatDateAffichage(prestation.date_souhaitee)}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-page">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Protégé
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Organisation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {prestations.map((prestation) => (
                  <tr
                    key={prestation.id}
                    className="border-b border-border transition-colors hover:bg-page"
                  >
                    <td className="px-4 py-3 text-sm text-text-strong">
                      {getNomMajeur(prestation.majeurs)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-strong">
                      {getNomOrganisation(prestation.organisations)}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-text-muted">
                      <span className="line-clamp-1">
                        {prestation.description}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                      {formatDateAffichage(prestation.date_souhaitee)}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
