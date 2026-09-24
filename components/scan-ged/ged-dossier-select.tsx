"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  formatCheminDossier,
  formatSegmentsCheminBreadcrumb,
} from "@/lib/documents/ged-dossier-utils";
import {
  libelleNouveauCheminDossierPropose,
  nettoyerNomSegmentDossier,
  NOUVEAU_DOSSIER_MANUEL,
  NOUVEAU_DOSSIER_SELECTION,
} from "@/lib/documents/ged-dossier-constants";
import { cn } from "@/lib/utils";
import type { GedDossier } from "@/types/documents";

interface GedDossierSelectProps {
  id: string;
  label: string;
  dossiers: GedDossier[];
  value: string;
  onChange: (dossierId: string) => void;
  disabled?: boolean;
  propositionNouveauCheminDossier?: string[] | null;
  nouveauCheminManuel?: string[];
  onNouveauCheminManuelChange?: (segments: string[]) => void;
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
}

export function GedDossierSelect({
  id,
  label,
  dossiers,
  value,
  onChange,
  disabled = false,
  propositionNouveauCheminDossier,
  nouveauCheminManuel,
  onNouveauCheminManuelChange,
}: GedDossierSelectProps) {
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null,
  );
  const [monte, setMonte] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const segmentsManuel =
    nouveauCheminManuel && nouveauCheminManuel.length > 0
      ? nouveauCheminManuel
      : [""];

  const options = useMemo(() => {
    const liste = dossiers.map((dossier) => ({
      id: dossier.id,
      label: formatCheminDossier(dossier.id, dossiers),
    }));

    const segments =
      propositionNouveauCheminDossier
        ?.map((segment) => segment.trim())
        .filter(Boolean) ?? [];

    const optionNouveauIa =
      segments.length > 0
        ? [
            {
              id: NOUVEAU_DOSSIER_SELECTION,
              label: libelleNouveauCheminDossierPropose(segments),
            },
          ]
        : [];

    const optionNouveauManuel = {
      id: NOUVEAU_DOSSIER_MANUEL,
      label: "Créer un nouveau dossier...",
    };

    return {
      optionNouveauManuel,
      autresOptions: [...optionNouveauIa, ...liste],
    };
  }, [dossiers, propositionNouveauCheminDossier]);

  const terme = recherche.trim().toLowerCase();
  const optionsFiltrees =
    terme.length > 0
      ? options.autresOptions.filter((option) =>
          option.label.toLowerCase().includes(terme),
        )
      : options.autresOptions;

  const libelleCheminManuel = formatSegmentsCheminBreadcrumb(segmentsManuel);
  const libelleSelectionne =
    value === NOUVEAU_DOSSIER_MANUEL
      ? libelleCheminManuel || "Nouveau dossier"
      : options.autresOptions.find((option) => option.id === value)?.label ??
        "Sélectionner un dossier…";

  function mettreAJourPositionPanel() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setPanelPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }

  function mettreAJourSegment(index: number, valeur: string) {
    const suivants = [...segmentsManuel];
    suivants[index] = nettoyerNomSegmentDossier(valeur);
    onNouveauCheminManuelChange?.(suivants);
  }

  function ajouterSousDossier() {
    onNouveauCheminManuelChange?.([...segmentsManuel, ""]);
  }

  function retirerSegment(index: number) {
    if (segmentsManuel.length <= 1) {
      return;
    }

    onNouveauCheminManuelChange?.(
      segmentsManuel.filter((_, position) => position !== index),
    );
  }

  useLayoutEffect(() => {
    if (!ouvert) {
      return;
    }

    mettreAJourPositionPanel();
  }, [ouvert, recherche, optionsFiltrees.length]);

  useEffect(() => {
    setMonte(true);
  }, []);

  useEffect(() => {
    if (!ouvert) {
      return;
    }

    function handleScrollOrResize() {
      mettreAJourPositionPanel();
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target)) {
        return;
      }

      if (panelRef.current?.contains(target)) {
        return;
      }

      setOuvert(false);
      setRecherche("");
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOuvert(false);
        setRecherche("");
      }
    }

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ouvert]);

  const panelDropdown =
    ouvert && !disabled && panelPosition && monte ? (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: panelPosition.top,
          left: panelPosition.left,
          width: panelPosition.width,
          zIndex: 9999,
        }}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      >
        <div className="border-b border-border p-2">
          <input
            id={`${id}-recherche`}
            type="search"
            placeholder="Rechercher un dossier…"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            className="w-full rounded-lg border border-border bg-page px-3 py-1.5 text-sm text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <ul className="max-h-48 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(options.optionNouveauManuel.id);
                onNouveauCheminManuelChange?.(
                  nouveauCheminManuel && nouveauCheminManuel.length > 0
                    ? nouveauCheminManuel
                    : [""],
                );
                setOuvert(false);
                setRecherche("");
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors",
                value === NOUVEAU_DOSSIER_MANUEL
                  ? "bg-accent/10 text-accent"
                  : "text-accent hover:bg-[#E6F7F5]",
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {options.optionNouveauManuel.label}
            </button>
          </li>
          <li className="border-b border-border" aria-hidden />
          {optionsFiltrees.length === 0 ? (
            <li className="px-3 py-2 text-xs text-text-muted">
              Aucun dossier trouvé
            </li>
          ) : (
            optionsFiltrees.map((option) => (
              <li key={option.id || "vide"}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOuvert(false);
                    setRecherche("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-colors",
                    value === option.id
                      ? "bg-accent/10 text-accent"
                      : "text-text-strong hover:bg-page",
                  )}
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    ) : null;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-text-muted"
      >
        {label}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setOuvert((prev) => !prev)}
          className={cn(
            "w-full rounded-lg border border-border bg-page px-3 py-2 text-left text-sm transition-colors",
            disabled
              ? "cursor-not-allowed opacity-50"
              : "hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
          )}
        >
          <span
            className={cn(
              "block truncate",
              value ? "text-text-strong" : "text-text-muted",
            )}
          >
            {libelleSelectionne}
          </span>
        </button>

        {panelDropdown && createPortal(panelDropdown, document.body)}
      </div>

      {value === NOUVEAU_DOSSIER_MANUEL && (
        <div className="mt-3 space-y-3">
          {segmentsManuel.map((segment, index) => {
            const champId = `${id}-segment-${index}`;
            const labelSegment =
              index === 0 ? "Nom du dossier" : "Nom du sous-dossier";

            return (
              <div key={champId} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={champId}
                    className="mb-1.5 block text-xs font-medium text-text-muted"
                  >
                    {labelSegment}
                    {index === 0 ? " *" : ""}
                  </label>
                  <input
                    id={champId}
                    value={segment}
                    onChange={(event) =>
                      mettreAJourSegment(index, event.target.value)
                    }
                    disabled={disabled}
                    autoFocus={
                      (index === 0 &&
                        !segment &&
                        segmentsManuel.length === 1) ||
                      (index === segmentsManuel.length - 1 &&
                        index > 0 &&
                        !segment)
                    }
                    placeholder={index === 0 ? "Ex. Santé" : "Ex. Ordonnances"}
                    className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => retirerSegment(index)}
                    disabled={disabled}
                    aria-label="Retirer ce niveau"
                    className="mb-0.5 rounded-lg p-2 text-text-muted transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={ajouterSousDossier}
            disabled={disabled}
            className="flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Ajouter un sous-dossier
          </button>
        </div>
      )}
    </div>
  );
}
