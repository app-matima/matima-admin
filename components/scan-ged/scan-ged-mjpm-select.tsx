"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { getMjpmNomComplet } from "@/lib/clients/utils";
import { cn } from "@/lib/utils";
import type { ScanGedOrganisation } from "@/types/scan-ged";

interface ScanGedMjpmSelectProps {
  organisations: ScanGedOrganisation[];
  onSelect: (organisation: ScanGedOrganisation) => void;
}

export function ScanGedMjpmSelect({
  organisations,
  onSelect,
}: ScanGedMjpmSelectProps) {
  const [recherche, setRecherche] = useState("");

  const organisationsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) {
      return organisations;
    }

    return organisations.filter((organisation) => {
      const mjpmNom = getMjpmNomComplet(organisation.mjpm).toLowerCase();
      const cabinet = organisation.cabinetNom.toLowerCase();
      return mjpmNom.includes(terme) || cabinet.includes(terme);
    });
  }, [organisations, recherche]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="search"
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder="Rechercher un MJPM ou un cabinet…"
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Rechercher un MJPM ou un cabinet"
        />
      </div>

      {organisationsFiltrees.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <Building2 className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              Aucun résultat
            </p>
            <p className="text-xs text-[#9CA3AF]">
              Essayez un autre nom de MJPM ou de cabinet
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {organisationsFiltrees.map((organisation) => (
            <button
              key={organisation.organisationId}
              type="button"
              onClick={() => onSelect(organisation)}
              className={cn(
                "rounded-xl border border-border bg-card p-4 text-left transition-colors",
                "hover:border-accent hover:bg-page",
              )}
            >
              <p className="text-sm font-medium text-text-strong">
                {getMjpmNomComplet(organisation.mjpm)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Cabinet : {organisation.cabinetNom}
              </p>
              {organisation.mjpm?.email && (
                <p className="mt-2 truncate text-xs text-[#9CA3AF]">
                  {organisation.mjpm.email}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
