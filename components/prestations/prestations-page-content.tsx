import { Briefcase } from "lucide-react";
import { PrestationsList } from "@/components/prestations/prestations-list";
import type { PrestationAvecRelations } from "@/types";

interface PrestationsPageContentProps {
  prestations: PrestationAvecRelations[];
}

export function PrestationsPageContent({
  prestations,
}: PrestationsPageContentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Prestations
      </h1>

      {prestations.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <Briefcase className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              Aucune prestation
            </p>
            <p className="text-xs text-[#9CA3AF]">
              Les demandes de prestations apparaîtront ici
            </p>
          </div>
        </div>
      ) : (
        <PrestationsList prestations={prestations} />
      )}
    </div>
  );
}
