interface MetricCardProps {
  label: string;
  value: number;
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-xs text-[#9CA3AF]">{label}</p>
      <p className="text-2xl font-medium text-text-strong">{value}</p>
    </div>
  );
}

interface MetricCardsProps {
  prestationsEnAttente: number;
  prestationsEnCours: number;
  clientsActifs: number;
  protegesTotal: number;
}

export function MetricCards({
  prestationsEnAttente,
  prestationsEnCours,
  clientsActifs,
  protegesTotal,
}: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard label="Prestations en attente" value={prestationsEnAttente} />
      <MetricCard label="Prestations en cours" value={prestationsEnCours} />
      <MetricCard label="Clients actifs" value={clientsActifs} />
      <MetricCard label="Protégés total" value={protegesTotal} />
    </div>
  );
}
