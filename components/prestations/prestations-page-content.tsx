import { Briefcase } from "lucide-react";
import { PrestationsList } from "@/components/prestations/prestations-list";
import type { PrestationAvecRelations } from "@/types";

export type PrestationsPageMode = "full" | "facturation";

interface PrestationsPageContentProps {
  prestations: PrestationAvecRelations[];
  mode?: PrestationsPageMode;
}

export function PrestationsPageContent({
  prestations,
  mode = "full",
}: PrestationsPageContentProps) {
  const isFacturation = mode === "facturation";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-text-strong">
          {isFacturation ? "Facturation des prestations" : "Prestations"}
        </h1>
        {isFacturation && (
          <p className="mt-1 text-sm text-text-muted">
            Prestations réalisées — liaison et suivi des factures Pennylane
          </p>
        )}
      </div>

      {prestations.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <Briefcase className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              {isFacturation
                ? "Aucune prestation réalisée"
                : "Aucune prestation"}
            </p>
            <p className="text-xs text-[#9CA3AF]">
              {isFacturation
                ? "Les prestations marquées réalisées apparaîtront ici pour facturation"
                : "Les demandes de prestations apparaîtront ici"}
            </p>
          </div>
        </div>
      ) : (
        <PrestationsList
          prestations={prestations}
          canManageStatut={!isFacturation}
          showStatutFilters={!isFacturation}
        />
      )}
    </div>
  );
}
