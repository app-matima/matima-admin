"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { AddCongeModal } from "@/components/planning/add-conge-modal";
import { CongePlanningModal } from "@/components/planning/conge-planning-modal";
import { PlanningCalendar } from "@/components/planning/planning-calendar";
import { PrestationPlanningModal } from "@/components/planning/prestation-planning-modal";
import { buildPlanningEvents } from "@/lib/planning/utils";
import type { AdminUser } from "@/types/admin";
import type { Conge, PlanningEvent, PlanningPrestation } from "@/types/planning";

interface PlanningPageContentProps {
  prestations: PlanningPrestation[];
  conges: Conge[];
  isAdmin: boolean;
  teamMembers: AdminUser[];
  currentUserId: string;
}

export function PlanningPageContent({
  prestations,
  conges,
  isAdmin,
  teamMembers,
  currentUserId,
}: PlanningPageContentProps) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedPrestation, setSelectedPrestation] =
    useState<PlanningPrestation | null>(null);
  const [selectedConge, setSelectedConge] = useState<Conge | null>(null);
  const [addCongeOpen, setAddCongeOpen] = useState(false);

  const allEvents = useMemo(
    () => buildPlanningEvents(prestations, conges),
    [prestations, conges],
  );

  function handlePreviousMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
      return;
    }

    setMonth((value) => value - 1);
  }

  function handleNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
      return;
    }

    setMonth((value) => value + 1);
  }

  function handleSelectEvent(event: PlanningEvent) {
    if (event.prestation) {
      setSelectedPrestation(event.prestation);
      setSelectedConge(null);
      return;
    }

    if (event.conge) {
      setSelectedConge(event.conge);
      setSelectedPrestation(null);
    }
  }

  function handleRefresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight text-text-strong">
          Planning
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddCongeOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Ajouter un congé
          </button>
        )}
      </div>

      <PlanningCalendar
        year={year}
        month={month}
        events={allEvents}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onSelectEvent={handleSelectEvent}
      />

      <PrestationPlanningModal
        prestation={selectedPrestation}
        teamMembers={teamMembers}
        onClose={() => setSelectedPrestation(null)}
        onUpdated={handleRefresh}
      />

      <CongePlanningModal
        conge={selectedConge}
        teamMembers={teamMembers}
        onClose={() => setSelectedConge(null)}
      />

      <AddCongeModal
        open={addCongeOpen}
        teamMembers={teamMembers}
        defaultAdminUserId={currentUserId}
        onClose={() => setAddCongeOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
