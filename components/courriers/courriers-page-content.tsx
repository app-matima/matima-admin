import { Mail } from "lucide-react";
import { CourriersList } from "@/components/courriers/courriers-list";
import type { CourrierAvecRelations } from "@/types/courriers";

interface CourriersPageContentProps {
  courriers: CourrierAvecRelations[];
}

export function CourriersPageContent({ courriers }: CourriersPageContentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Courriers
      </h1>

      {courriers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <Mail className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              Aucun courrier
            </p>
            <p className="text-xs text-[#9CA3AF]">
              Les courriers envoyés depuis les cabinets apparaîtront ici
            </p>
          </div>
        </div>
      ) : (
        <CourriersList courriers={courriers} />
      )}
    </div>
  );
}
