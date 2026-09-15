import { getNomMajeur } from "@/lib/prestations/utils";
import { truncateText } from "@/lib/utils/date";
import type {
  CalendarDay,
  Conge,
  PlanningEvent,
  PlanningEventKind,
  PlanningPrestation,
} from "@/types/planning";
import type { StatutPrestation } from "@/types";

const JOURS_SEMAINE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

export { JOURS_SEMAINE };

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Lundi (inclus) de la semaine ISO-like (lun→dim) contenant `date`. */
export function getWeekStart(date: Date = new Date()): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function getWeekDateKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    formatDateKey(addDays(weekStart, index)),
  );
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();

  if (sameMonth) {
    return `${weekStart.getDate()} – ${weekEnd.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }

  const debut = weekStart.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const fin = weekEnd.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${debut} – ${fin}`;
}

export function dateStringToKey(dateStr: string): string {
  return dateStr.split("T")[0] ?? dateStr;
}

export function expandDateRange(debut: string, fin: string): string[] {
  const [startY, startM, startD] = dateStringToKey(debut).split("-").map(Number);
  const [endY, endM, endD] = dateStringToKey(fin).split("-").map(Number);

  const dates: string[] = [];
  const current = new Date(startY, startM - 1, startD);
  const end = new Date(endY, endM - 1, endD);

  while (current <= end) {
    dates.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getPrestationEventKind(statut: StatutPrestation): PlanningEventKind {
  if (statut === "en_attente") {
    return "prestation_pending";
  }

  return "prestation_confirmed";
}

function getPrestationLabel(prestation: PlanningPrestation): string {
  const majeur = getNomMajeur(prestation.majeurs);
  if (majeur !== "—") {
    return truncateText(majeur, 24);
  }

  return truncateText(prestation.description, 24);
}

export function buildPlanningEvents(
  prestations: PlanningPrestation[],
  conges: Conge[],
): PlanningEvent[] {
  const events: PlanningEvent[] = [];

  for (const prestation of prestations) {
    const dateKey = dateStringToKey(prestation.date_souhaitee);
    const kind = getPrestationEventKind(prestation.statut);

    events.push({
      id: `prestation-${prestation.id}-${dateKey}`,
      kind,
      dateKey,
      label: getPrestationLabel(prestation),
      prestation,
    });
  }

  for (const conge of conges) {
    const dateKeys = expandDateRange(conge.date_debut, conge.date_fin);

    for (const dateKey of dateKeys) {
      events.push({
        id: `conge-${conge.id}-${dateKey}`,
        kind: "conge",
        dateKey,
        label: truncateText(conge.titre, 24),
        conge,
      });
    }
  }

  return events;
}

export function groupEventsByDate(
  events: PlanningEvent[],
): Map<string, PlanningEvent[]> {
  const map = new Map<string, PlanningEvent[]>();

  for (const event of events) {
    const existing = map.get(event.dateKey) ?? [];
    existing.push(event);
    map.set(event.dateKey, existing);
  }

  return map;
}

export function buildCalendarMonth(year: number, month: number): CalendarDay[] {
  const todayKey = formatDateKey(new Date());
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);
  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + index,
    );

    days.push({
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: formatDateKey(date) === todayKey,
    });
  }

  return days;
}

export function formatMonthLabel(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const planningEventStyles: Record<
  PlanningEventKind,
  { badge: string; dot: string }
> = {
  prestation_confirmed: {
    badge: "bg-[#E6F7F5] text-[#00796B] hover:bg-[#D1F0EC]",
    dot: "bg-[#00A394]",
  },
  prestation_pending: {
    badge: "bg-[#FFF8E1] text-[#B45309] hover:bg-[#FEF3C7]",
    dot: "bg-[#F59E0B]",
  },
  conge: {
    badge: "bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2]",
    dot: "bg-[#DC2626]",
  },
  tache: {
    badge: "bg-[#EEF2FF] text-[#3730A3] hover:bg-[#E0E7FF]",
    dot: "bg-[#6366F1]",
  },
};
