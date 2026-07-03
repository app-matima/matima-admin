import { KeyRound } from "lucide-react";
import { ClesList } from "@/components/cles/cles-list";
import type { OrganisationClesGroupe } from "@/types/cles";

interface ClesPageContentProps {
  groupes: OrganisationClesGroupe[];
}

export function ClesPageContent({ groupes }: ClesPageContentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Clés
      </h1>

      {groupes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <KeyRound className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              Aucun protégé
            </p>
            <p className="text-xs text-[#9CA3AF]">
              Les clés des protégés apparaîtront ici
            </p>
          </div>
        </div>
      ) : (
        <ClesList groupes={groupes} />
      )}
    </div>
  );
}
