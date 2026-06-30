import { formatDateAffichage } from "@/lib/utils/date";
import type { Organisation } from "@/types";

interface NouveauxClientsProps {
  clients: Organisation[];
}

export function NouveauxClients({ clients }: NouveauxClientsProps) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-medium text-text-strong">
          Nouveaux clients
        </h2>
      </div>

      {clients.length === 0 ? (
        <p className="p-4 text-sm text-text-muted">
          Aucun client enregistré pour le moment.
        </p>
      ) : (
        <>
          <div className="divide-y divide-border lg:hidden">
            {clients.map((client) => (
              <div key={client.id} className="space-y-1 p-4">
                <p className="text-sm font-medium text-text-strong">
                  {client.nom}
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  Inscrit le {formatDateAffichage(client.created_at)}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-page">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Cabinet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Date d&apos;inscription
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-border transition-colors hover:bg-page"
                  >
                    <td className="px-4 py-3 text-sm text-text-strong">
                      {client.nom}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                      {formatDateAffichage(client.created_at)}
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
