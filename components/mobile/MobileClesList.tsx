"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, Search } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import {
  filtrerGroupesCles,
  filtrerGroupesParRecherche,
  filtresCle,
  getNomProtege,
  getStatutCleBadgeVariant,
  getStatutCleLabel,
  type FiltreCle,
} from "@/lib/cles/utils";
import { getMjpmNomComplet } from "@/lib/clients/utils";
import { cn } from "@/lib/utils";
import type { OrganisationClesGroupe } from "@/types/cles";

interface MobileClesListProps {
  groupes: OrganisationClesGroupe[];
}

export function MobileClesList({ groupes }: MobileClesListProps) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreCle>("tous");

  const lignes = useMemo(() => {
    const groupesFiltres = filtrerGroupesParRecherche(
      filtrerGroupesCles(groupes, filtre),
      recherche,
    );

    return groupesFiltres.flatMap((groupe) =>
      groupe.proteges.map((protege) => ({
        ...protege,
        mjpmNom: getMjpmNomComplet(groupe.mjpm),
      })),
    );
  }, [groupes, filtre, recherche]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-text-strong">
        Clés
      </h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="search"
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder="Rechercher un MJPM ou un protégé…"
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Rechercher un MJPM ou un protégé"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filtresCle.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFiltre(option.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              filtre === option.id
                ? "bg-accent text-white"
                : "border border-border bg-card text-text-muted hover:bg-page hover:text-text-strong",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {lignes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
            <KeyRound className="h-6 w-6 text-[#9CA3AF]" aria-hidden />
          </div>
          <p className="text-sm font-medium text-text-strong">Aucun résultat</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Essayez une autre recherche ou un autre filtre
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {lignes.map((ligne) => (
            <li key={ligne.cleId}>
              <Link
                href={`/m/cles/${ligne.cleId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-page"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-text-strong">
                      {getNomProtege(ligne)}
                    </p>
                    <Badge
                      variant={getStatutCleBadgeVariant(ligne.statut)}
                      className="shrink-0"
                    >
                      {getStatutCleLabel(ligne.statut)}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-text-muted">
                    {ligne.mjpmNom}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[#9CA3AF]"
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
