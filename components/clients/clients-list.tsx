"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { ClientDetailModal } from "@/components/clients/client-detail-modal";
import { getMjpmNomComplet, matchesMjpmSearch } from "@/lib/clients/utils";
import { formatPlanLabel } from "@/lib/clients/plans";
import { formatDateAffichage } from "@/lib/utils/date";
import type { ClientListItem } from "@/types/clients";
import type { Plan } from "@/lib/clients/plans";

interface ClientsListProps {
  clients: ClientListItem[];
  plans: Plan[];
}

export function ClientsList({ clients, plans }: ClientsListProps) {
  const [recherche, setRecherche] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientListItem | null>(
    null,
  );

  const clientsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) {
      return clients;
    }

    return clients.filter((client) => matchesMjpmSearch(client, terme));
  }, [clients, recherche]);

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher un MJPM…"
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            aria-label="Rechercher un MJPM"
          />
        </div>

        {clientsFiltres.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
                <Building2 className="h-6 w-6 text-[#9CA3AF]" />
              </div>
              <p className="mb-1 text-sm font-medium text-text-strong">
                Aucun client trouvé
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Essayez un autre nom de MJPM
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 lg:hidden">
              {clientsFiltres.map((client) => (
                <button
                  key={client.organisationId}
                  type="button"
                  onClick={() => setSelectedClient(client)}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-page"
                >
                  <p className="text-sm font-medium text-text-strong">
                    {getMjpmNomComplet(client.mjpm)}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {client.mjpm?.email ?? "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#9CA3AF]">
                    <span>
                      Plan : {formatPlanLabel(client.plan, client.plan_id)}
                    </span>
                    <span>
                      Inscrit le {formatDateAffichage(client.created_at)}
                    </span>
                    <span>
                      <span className="font-medium text-text-strong">
                        {client.protegesActifs}
                      </span>{" "}
                      dossiers actifs
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
                      MJPM
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Inscription
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Dossiers actifs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientsFiltres.map((client) => (
                    <tr
                      key={client.organisationId}
                      onClick={() => setSelectedClient(client)}
                      className="cursor-pointer border-b border-border transition-colors hover:bg-page"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-text-strong whitespace-nowrap">
                        {getMjpmNomComplet(client.mjpm)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {client.mjpm?.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {formatPlanLabel(client.plan, client.plan_id)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                        {formatDateAffichage(client.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-strong">
                        {client.protegesActifs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ClientDetailModal
        client={selectedClient}
        plans={plans}
        onClose={() => setSelectedClient(null)}
      />
    </>
  );
}
