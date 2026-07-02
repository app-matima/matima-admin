import { Building2 } from "lucide-react";
import { ClientsList } from "@/components/clients/clients-list";
import type { ClientListItem } from "@/types/clients";

interface ClientsPageContentProps {
  clients: ClientListItem[];
}

export function ClientsPageContent({ clients }: ClientsPageContentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Clients
      </h1>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <Building2 className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              Aucun client
            </p>
            <p className="text-xs text-[#9CA3AF]">
              Les cabinets inscrits apparaîtront ici
            </p>
          </div>
        </div>
      ) : (
        <ClientsList clients={clients} />
      )}
    </div>
  );
}
