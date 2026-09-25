"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
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

interface OptionSpeciale {
  id: string;
  label: string;
}

function estRacine(dossier: GedDossier): boolean {
  return dossier.parent_id == null || dossier.parent_id === "";
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
  /** Pile des parents visités (vide = racine). */
  const [pileParents, setPileParents] = useState<string[]>([]);
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

  const dossiersParParent = useMemo(() => {
    const map = new Map<string | null, GedDossier[]>();

    for (const dossier of dossiers) {
      const parentCle = estRacine(dossier) ? null : dossier.parent_id!;
      const liste = map.get(parentCle) ?? [];
      liste.push(dossier);
      map.set(parentCle, liste);
    }

    for (const liste of map.values()) {
      liste.sort((a, b) =>
        a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
      );
    }

    return map;
  }, [dossiers]);

  const enfantsDe = (parentId: string | null): GedDossier[] =>
    dossiersParParent.get(parentId) ?? [];

  const aDesEnfants = (dossierId: string): boolean =>
    (dossiersParParent.get(dossierId)?.length ?? 0) > 0;

  const parentCourant =
    pileParents.length > 0 ? (pileParents[pileParents.length - 1] ?? null) : null;

  const dossiersDuNiveau = enfantsDe(parentCourant);

  const filAriane = useMemo(() => {
    return pileParents
      .map((dossierId) => {
        const dossier = dossiers.find((item) => item.id === dossierId);
        return dossier
          ? { id: dossier.id, nom: dossier.nom }
          : { id: dossierId, nom: "…" };
      })
      .filter(Boolean);
  }, [pileParents, dossiers]);

  const optionNouveauIa: OptionSpeciale | null = useMemo(() => {
    const segments =
      propositionNouveauCheminDossier
        ?.map((segment) => segment.trim())
        .filter(Boolean) ?? [];

    if (segments.length === 0) {
      return null;
    }

    return {
      id: NOUVEAU_DOSSIER_SELECTION,
      label: libelleNouveauCheminDossierPropose(segments),
    };
  }, [propositionNouveauCheminDossier]);

  const optionNouveauManuel: OptionSpeciale = {
    id: NOUVEAU_DOSSIER_MANUEL,
    label: "Créer un nouveau dossier...",
  };

  const terme = recherche.trim().toLowerCase();
  const enModeRecherche = terme.length > 0;

  const resultatsRecherche = useMemo(() => {
    if (!enModeRecherche) {
      return [];
    }

    return dossiers
      .map((dossier) => ({
        id: dossier.id,
        label: formatCheminDossier(dossier.id, dossiers),
      }))
      .filter((option) => option.label.toLowerCase().includes(terme))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
      );
  }, [dossiers, enModeRecherche, terme]);

  const libelleCheminManuel = formatSegmentsCheminBreadcrumb(segmentsManuel);
  const libelleSelectionne = (() => {
    if (value === NOUVEAU_DOSSIER_MANUEL) {
      return libelleCheminManuel || "Nouveau dossier";
    }
    if (value === NOUVEAU_DOSSIER_SELECTION && optionNouveauIa) {
      return optionNouveauIa.label;
    }
    if (value) {
      const chemin = formatCheminDossier(value, dossiers);
      return chemin || "Sélectionner un dossier…";
    }
    return "Sélectionner un dossier…";
  })();

  function fermerPanel() {
    setOuvert(false);
    setRecherche("");
    setPileParents([]);
  }

  function selectionner(dossierId: string) {
    onChange(dossierId);
    fermerPanel();
  }

  function naviguerVers(dossierId: string) {
    setPileParents((courante) => [...courante, dossierId]);
  }

  function remonter() {
    setPileParents((courante) => courante.slice(0, -1));
  }

  function allerAuNiveau(index: number) {
    // index -1 = racine ; sinon coupe la pile après index
    if (index < 0) {
      setPileParents([]);
      return;
    }
    setPileParents((courante) => courante.slice(0, index + 1));
  }

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
  }, [
    ouvert,
    recherche,
    pileParents.length,
    dossiersDuNiveau.length,
    resultatsRecherche.length,
  ]);

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

      fermerPanel();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        fermerPanel();
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

        {!enModeRecherche && pileParents.length > 0 && (
          <div className="flex items-center gap-1 border-b border-border bg-page/60 px-2 py-1.5">
            <button
              type="button"
              onClick={remonter}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-[#E6F7F5]"
              aria-label="Retour au niveau précédent"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Retour
            </button>
            <nav
              className="min-w-0 flex-1 truncate text-xs text-text-muted"
              aria-label="Fil d'Ariane"
            >
              <button
                type="button"
                onClick={() => allerAuNiveau(-1)}
                className="hover:text-accent hover:underline"
              >
                Racine
              </button>
              {filAriane.map((segment, index) => (
                <span key={segment.id}>
                  <span className="mx-1 text-border">/</span>
                  <button
                    type="button"
                    onClick={() => allerAuNiveau(index)}
                    className={cn(
                      "hover:text-accent hover:underline",
                      index === filAriane.length - 1 &&
                        "font-medium text-text-strong",
                    )}
                  >
                    {segment.nom}
                  </button>
                </span>
              ))}
            </nav>
          </div>
        )}

        <ul className="max-h-56 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(optionNouveauManuel.id);
                onNouveauCheminManuelChange?.(
                  nouveauCheminManuel && nouveauCheminManuel.length > 0
                    ? nouveauCheminManuel
                    : [""],
                );
                fermerPanel();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors",
                value === NOUVEAU_DOSSIER_MANUEL
                  ? "bg-accent/10 text-accent"
                  : "text-accent hover:bg-[#E6F7F5]",
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {optionNouveauManuel.label}
            </button>
          </li>

          {optionNouveauIa && (
            <li>
              <button
                type="button"
                onClick={() => selectionner(optionNouveauIa.id)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  value === optionNouveauIa.id
                    ? "bg-accent/10 text-accent"
                    : "text-text-strong hover:bg-page",
                )}
              >
                {optionNouveauIa.label}
              </button>
            </li>
          )}

          <li className="border-b border-border" aria-hidden />

          {enModeRecherche ? (
            resultatsRecherche.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-muted">
                Aucun dossier trouvé
              </li>
            ) : (
              resultatsRecherche.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => selectionner(option.id)}
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
            )
          ) : dossiersDuNiveau.length === 0 ? (
            <li className="px-3 py-2 text-xs text-text-muted">
              {parentCourant
                ? "Aucun sous-dossier"
                : "Aucun dossier pour ce protégé"}
            </li>
          ) : (
            dossiersDuNiveau.map((dossier) => {
              const avecEnfants = aDesEnfants(dossier.id);
              const estSelectionne = value === dossier.id;

              if (!avecEnfants) {
                return (
                  <li key={dossier.id}>
                    <button
                      type="button"
                      onClick={() => selectionner(dossier.id)}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm transition-colors",
                        estSelectionne
                          ? "bg-accent/10 text-accent"
                          : "text-text-strong hover:bg-page",
                      )}
                    >
                      {dossier.nom}
                    </button>
                  </li>
                );
              }

              return (
                <li
                  key={dossier.id}
                  className={cn(
                    "flex items-stretch border-b border-border/60 last:border-b-0",
                    estSelectionne && "bg-accent/10",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectionner(dossier.id)}
                    title="Sélectionner ce dossier"
                    className={cn(
                      "min-w-0 flex-1 px-3 py-2 text-left text-sm transition-colors hover:bg-page",
                      estSelectionne ? "text-accent" : "text-text-strong",
                    )}
                  >
                    {dossier.nom}
                  </button>
                  <button
                    type="button"
                    onClick={() => naviguerVers(dossier.id)}
                    title="Voir les sous-dossiers"
                    aria-label={`Ouvrir ${dossier.nom}`}
                    className="flex shrink-0 items-center gap-0.5 border-l border-border px-2.5 text-text-muted transition-colors hover:bg-page hover:text-accent"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })
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
          onClick={() => {
            if (ouvert) {
              fermerPanel();
            } else {
              setPileParents([]);
              setRecherche("");
              setOuvert(true);
            }
          }}
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
