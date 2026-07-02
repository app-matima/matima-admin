import type { PlanningEventKind } from "@/types/planning";
import { planningEventStyles } from "@/lib/planning/utils";
import { cn } from "@/lib/utils";

interface PlanningEventBadgeProps {
  label: string;
  kind: PlanningEventKind;
  onClick: () => void;
}

export function PlanningEventBadge({
  label,
  kind,
  onClick,
}: PlanningEventBadgeProps) {
  const styles = planningEventStyles[kind];

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-colors sm:text-xs",
        styles.badge,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} />
      <span className="truncate">{label}</span>
    </button>
  );
}
