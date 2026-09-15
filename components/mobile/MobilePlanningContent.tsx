"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/shared/badge";
import {
  addDays,
  dateStringToKey,
  formatDateKey,
  formatWeekRangeLabel,
  getWeekDateKeys,
  getWeekStart,
  parseDateKey,
} from "@/lib/planning/utils";
import {
  formatHeureSouhaitee,
  getNomMajeur,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
} from "@/lib/prestations/utils";
import type { PlanningPrestation, TacheAdmin } from "@/types/planning";

interface MobilePlanningContentProps {
  weekStartKey: string;
  prestations: PlanningPrestation[];
  taches: TacheAdmin[];
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const inputClassName =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function MobilePlanningContent({
  weekStartKey,
  prestations,
  taches,
}: MobilePlanningContentProps) {
  const router = useRouter();
  const weekStart = getWeekStart(parseDateKey(weekStartKey));
  const weekKeys = getWeekDateKeys(weekStart);
  const todayKey = formatDateKey(new Date());

  const [addOpen, setAddOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<
      string,
      { prestations: PlanningPrestation[]; taches: TacheAdmin[] }
    >();

    for (const key of weekKeys) {
      map.set(key, { prestations: [], taches: [] });
    }

    for (const prestation of prestations) {
      const key = dateStringToKey(prestation.date_souhaitee);
      const bucket = map.get(key);
      if (bucket) {
        bucket.prestations.push(prestation);
      }
    }

    for (const tache of taches) {
      const key = dateStringToKey(tache.date);
      const bucket = map.get(key);
      if (bucket) {
        bucket.taches.push(tache);
      }
    }

    return map;
  }, [weekKeys, prestations, taches]);

  function goToWeek(offsetWeeks: number) {
    const next = addDays(weekStart, offsetWeeks * 7);
    const params = new URLSearchParams({ semaine: formatDateKey(next) });
    router.push(`/m/planning?${params.toString()}`);
  }

  function openAdd(defaultDate?: string) {
    setTitre("");
    setNotes("");
    setDate(defaultDate ?? todayKey);
    setErreur(null);
    setAddOpen(true);
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);

    if (!titre.trim()) {
      setErreur("Le titre est obligatoire.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/taches-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: titre.trim(),
          date,
          notes: notes.trim() || undefined,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setErreur(result.error ?? "Impossible de créer la tâche.");
        return;
      }

      setAddOpen(false);
      router.refresh();
    });
  }

  function handleDelete(tacheId: string) {
    setDeletingId(tacheId);
    startTransition(async () => {
      const response = await fetch(`/api/taches-admin/${tacheId}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setErreur(result.error ?? "Impossible de supprimer la tâche.");
        setDeletingId(null);
        return;
      }

      setDeletingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-text-strong">
          Planning
        </h1>
        <button
          type="button"
          onClick={() => openAdd()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover"
          aria-label="Ajouter une tâche"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-2 py-2">
        <button
          type="button"
          onClick={() => goToWeek(-1)}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-center text-sm font-medium text-text-strong">
          {formatWeekRangeLabel(weekStart)}
        </p>
        <button
          type="button"
          onClick={() => goToWeek(1)}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {erreur && !addOpen && (
        <p className="text-sm text-[#DC2626]">{erreur}</p>
      )}

      <div className="space-y-3">
        {weekKeys.map((dateKey, index) => {
          const day = byDay.get(dateKey) ?? { prestations: [], taches: [] };
          const isToday = dateKey === todayKey;
          const dayDate = parseDateKey(dateKey);
          const empty =
            day.prestations.length === 0 && day.taches.length === 0;

          return (
            <section
              key={dateKey}
              className={`overflow-hidden rounded-xl border bg-card ${
                isToday ? "border-accent" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between border-b border-border bg-page px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-text-strong">
                    {JOURS[index]}
                    {isToday ? (
                      <span className="ml-2 text-xs font-medium text-accent">
                        Aujourd&apos;hui
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-text-muted">
                    {dayDate.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openAdd(dateKey)}
                  className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-card hover:text-accent"
                  aria-label={`Ajouter une tâche le ${dateKey}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {empty ? (
                <p className="px-4 py-4 text-sm text-text-muted">Rien de prévu</p>
              ) : (
                <ul className="divide-y divide-border">
                  {day.taches.map((tache) => (
                    <li
                      key={tache.id}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#3730A3]">
                        <CheckSquare className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-strong">
                          {tache.titre}
                        </p>
                        {tache.notes?.trim() ? (
                          <p className="mt-0.5 whitespace-pre-wrap text-xs text-text-muted">
                            {tache.notes.trim()}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-[#9CA3AF]">Tâche</p>
                      </div>
                      <button
                        type="button"
                        disabled={isPending && deletingId === tache.id}
                        onClick={() => handleDelete(tache.id)}
                        className="rounded-lg p-2 text-text-muted transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50"
                        aria-label={`Supprimer ${tache.titre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}

                  {day.prestations.map((prestation) => (
                    <li
                      key={prestation.id}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6F7F5] text-[#00796B]">
                        <Briefcase className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-text-strong">
                            {getNomMajeur(prestation.majeurs)}
                          </p>
                          <Badge
                            variant={getStatutPrestationBadgeVariant(
                              prestation.statut,
                            )}
                          >
                            {getStatutPrestationLabel(prestation.statut)}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-xs text-text-muted">
                          {prestation.description}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF]">
                          Prestation
                          {prestation.heure_souhaitee
                            ? ` · ${formatHeureSouhaitee(prestation.heure_souhaitee)}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-tache-titre"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#0F1923]/50"
            onClick={() => !isPending && setAddOpen(false)}
            aria-label="Fermer"
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-t-xl border border-border bg-card sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2
                id="add-tache-titre"
                className="text-lg font-medium text-text-strong"
              >
                Nouvelle tâche
              </h2>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setAddOpen(false)}
                className="rounded-lg p-2 text-text-muted hover:bg-page hover:text-text-strong disabled:opacity-50"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-4">
              <div>
                <label htmlFor="tache-titre" className="mb-1.5 block text-xs font-medium text-text-muted">
                  Titre
                </label>
                <input
                  id="tache-titre"
                  type="text"
                  required
                  value={titre}
                  onChange={(event) => setTitre(event.target.value)}
                  className={inputClassName}
                  placeholder="Ex. Appeler le cabinet Dupont"
                  disabled={isPending}
                />
              </div>

              <div>
                <label htmlFor="tache-date" className="mb-1.5 block text-xs font-medium text-text-muted">
                  Date
                </label>
                <input
                  id="tache-date"
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={inputClassName}
                  disabled={isPending}
                />
              </div>

              <div>
                <label htmlFor="tache-notes" className="mb-1.5 block text-xs font-medium text-text-muted">
                  Notes (optionnel)
                </label>
                <textarea
                  id="tache-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={inputClassName}
                  disabled={isPending}
                />
              </div>

              {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Création…" : "Ajouter"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
