"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlanningEventBadge } from "@/components/planning/planning-event-badge";
import {
  JOURS_SEMAINE,
  buildCalendarMonth,
  formatMonthLabel,
  groupEventsByDate,
} from "@/lib/planning/utils";
import { cn } from "@/lib/utils";
import type { PlanningEvent } from "@/types/planning";

const MAX_EVENTS_MOBILE = 2;
const MAX_EVENTS_DESKTOP = 3;

interface PlanningCalendarProps {
  year: number;
  month: number;
  events: PlanningEvent[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectEvent: (event: PlanningEvent) => void;
}

export function PlanningCalendar({
  year,
  month,
  events,
  onPreviousMonth,
  onNextMonth,
  onSelectEvent,
}: PlanningCalendarProps) {
  const days = useMemo(() => buildCalendarMonth(year, month), [year, month]);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-medium text-text-strong sm:text-lg">
          {formatMonthLabel(year, month)}
        </h2>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="hidden border-b border-border bg-page sm:grid sm:grid-cols-7">
        {JOURS_SEMAINE.map((jour) => (
          <div
            key={jour}
            className="px-2 py-2 text-center text-xs font-medium text-text-muted"
          >
            {jour}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDate.get(day.dateKey) ?? [];
          const visibleMobile = dayEvents.slice(0, MAX_EVENTS_MOBILE);
          const hiddenMobileCount = dayEvents.length - visibleMobile.length;
          const visibleDesktop = dayEvents.slice(0, MAX_EVENTS_DESKTOP);
          const hiddenDesktopCount = dayEvents.length - visibleDesktop.length;

          return (
            <div
              key={day.dateKey}
              className={cn(
                "min-h-[4.5rem] border-b border-r border-border p-1 sm:min-h-[6.5rem] sm:p-1.5",
                !day.isCurrentMonth && "bg-page/60",
                day.isToday && "ring-1 ring-inset ring-accent/40",
              )}
            >
              <p
                className={cn(
                  "mb-1 text-right text-[10px] font-medium sm:text-xs",
                  day.isCurrentMonth ? "text-text-strong" : "text-text-muted",
                  day.isToday && "text-accent",
                )}
              >
                {day.date.getDate()}
              </p>

              <div className="space-y-0.5 sm:hidden">
                {visibleMobile.map((event) => (
                  <PlanningEventBadge
                    key={event.id}
                    label={event.label}
                    kind={event.kind}
                    onClick={() => onSelectEvent(event)}
                  />
                ))}
                {hiddenMobileCount > 0 && (
                  <p className="px-1 text-[10px] text-text-muted">
                    +{hiddenMobileCount}
                  </p>
                )}
              </div>

              <div className="hidden space-y-0.5 sm:block">
                {visibleDesktop.map((event) => (
                  <PlanningEventBadge
                    key={event.id}
                    label={event.label}
                    kind={event.kind}
                    onClick={() => onSelectEvent(event)}
                  />
                ))}
                {hiddenDesktopCount > 0 && (
                  <p className="px-1 text-xs text-text-muted">
                    +{hiddenDesktopCount}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border p-3 text-xs text-text-muted">
        <LegendItem color="bg-[#00A394]" label="Prestation confirmée" />
        <LegendItem color="bg-[#F59E0B]" label="Prestation en attente" />
        <LegendItem color="bg-[#DC2626]" label="Congé" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}
