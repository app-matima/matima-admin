import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import {
  getNomMajeur,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import { formatDateAffichage } from "@/lib/utils/date";
import type { PrestationAvecRelations } from "@/types";

interface MobilePrestationsListProps {
  prestations: PrestationAvecRelations[];
}

export function MobilePrestationsList({
  prestations,
}: MobilePrestationsListProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-text-strong">
        Prestations
      </h1>

      {prestations.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
            <Briefcase className="h-6 w-6 text-[#9CA3AF]" aria-hidden />
          </div>
          <p className="text-sm font-medium text-text-strong">
            Aucune prestation
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Aucune commande de prestation pour le moment.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {prestations.map((prestation) => (
            <li key={prestation.id}>
              <Link
                href={`/m/prestations/${prestation.id}`}
                className="flex items-start gap-3 px-4 py-3 transition-colors active:bg-page"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-text-strong">
                      {getNomMajeur(prestation.majeurs)}
                    </p>
                    <Badge
                      variant={getStatutPrestationBadgeVariant(
                        prestation.statut,
                      )}
                      className="shrink-0"
                    >
                      {getStatutPrestationLabel(prestation.statut)}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-text-muted">
                    {prestation.description}
                  </p>
                  <p className="text-xs text-[#9CA3AF]">
                    {formatDateAffichage(prestation.date_souhaitee)}
                  </p>
                </div>
                <ChevronRight
                  className="mt-1 h-4 w-4 shrink-0 text-[#9CA3AF]"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
