import { MobilePlanningContent } from "@/components/mobile/MobilePlanningContent";
import { getMobilePlanningWeekData } from "@/lib/planning/get-planning-data";
import {
  formatDateKey,
  getWeekStart,
  parseDateKey,
} from "@/lib/planning/utils";

export const dynamic = "force-dynamic";

interface MobilePlanningPageProps {
  searchParams: Promise<{ semaine?: string }>;
}

function resolveWeekStartKey(semaine: string | undefined): string {
  if (semaine && /^\d{4}-\d{2}-\d{2}$/.test(semaine)) {
    return formatDateKey(getWeekStart(parseDateKey(semaine)));
  }

  return formatDateKey(getWeekStart(new Date()));
}

export default async function MobilePlanningPage({
  searchParams,
}: MobilePlanningPageProps) {
  const params = await searchParams;
  const weekStartKey = resolveWeekStartKey(params.semaine);
  const data = await getMobilePlanningWeekData(weekStartKey);

  return (
    <MobilePlanningContent
      weekStartKey={data.weekStartKey}
      prestations={data.prestations}
      taches={data.taches}
    />
  );
}
