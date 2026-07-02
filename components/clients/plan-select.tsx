"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrganisationPlan } from "@/lib/clients/actions";
import { AUCUN_PLAN_LABEL, formatPlanLabel } from "@/lib/clients/plans";
import type { Plan } from "@/lib/clients/plans";

interface PlanSelectProps {
  organisationId: string;
  planId: string | null;
  plans: Plan[];
  onPlanUpdated: (plan: Plan) => void;
}

export function PlanSelect({
  organisationId,
  planId,
  plans,
  onPlanUpdated,
}: PlanSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newPlanId = event.target.value;
    const newPlan = plans.find((plan) => plan.id === newPlanId);
    if (!newPlan) {
      return;
    }

    setErreur(null);
    startTransition(async () => {
      const result = await updateOrganisationPlan(organisationId, newPlanId);
      if (!result.success) {
        setErreur(result.error ?? "Impossible de mettre à jour le plan.");
        return;
      }
      onPlanUpdated(newPlan);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="client-plan-select"
        className="block text-xs font-medium text-text-muted"
      >
        Changer de plan
      </label>
      <select
        id="client-plan-select"
        value={planId ?? ""}
        onChange={handleChange}
        disabled={isPending || plans.length === 0}
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
      >
        {plans.length === 0 ? (
          <option value="">Aucun plan disponible</option>
        ) : (
          <>
            {!planId && (
              <option value="">{AUCUN_PLAN_LABEL}</option>
            )}
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {formatPlanLabel(plan, plan.id)}
              </option>
            ))}
          </>
        )}
      </select>
      {isPending && (
        <p className="text-xs text-text-muted">Mise à jour du plan…</p>
      )}
      {erreur && <p className="text-xs text-[#DC2626]">{erreur}</p>}
    </div>
  );
}
