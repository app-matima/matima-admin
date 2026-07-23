"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { updateTvaMontantDejaProvisionne } from "@/lib/finances/actions";
import type { TvaEstimation } from "@/lib/finances/get-tva-estimation";
import { formatDateAffichage } from "@/lib/utils/date";

interface TvaPageContentProps {
  estimation: TvaEstimation;
}

function formatEuro(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(montant);
}

export function TvaPageContent({ estimation }: TvaPageContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [montantProvisionne, setMontantProvisionne] = useState(
    String(estimation.montantDejaProvisionne),
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    setMontantProvisionne(String(estimation.montantDejaProvisionne));
  }, [estimation.montantDejaProvisionne]);

  const montantSaisi = Number.parseFloat(
    montantProvisionne.replace(",", "."),
  );
  const montantValide = Number.isFinite(montantSaisi) ? montantSaisi : 0;
  const resteAProvisionnerPreview =
    Math.round((estimation.tvaEstimee - montantValide) * 100) / 100;

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur(null);
    setSucces(null);

    if (!Number.isFinite(montantSaisi) || montantSaisi < 0) {
      setErreur("Saisissez un montant valide (positif ou nul).");
      return;
    }

    startTransition(async () => {
      const result = await updateTvaMontantDejaProvisionne(montantSaisi);

      if (!result.success) {
        setErreur(result.error ?? "Impossible d'enregistrer le montant.");
        return;
      }

      setSucces("Montant provisionné enregistré.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-text-strong">
          Estimation TVA {estimation.annee}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Cumul Pennylane depuis le {formatDateAffichage(estimation.dateDebut)}{" "}
          (année civile en cours)
        </p>
      </div>

      <div
        className="flex gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
        <p className="text-sm text-[#92400E]">
          Estimation approximative à titre indicatif uniquement — ne remplace
          pas votre déclaration officielle, à valider avec votre comptable.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="TVA collectée"
          value={formatEuro(estimation.tvaCollectee)}
          hint={`${estimation.nbFacturesClients} facture${estimation.nbFacturesClients > 1 ? "s" : ""} client`}
        />
        <MetricCard
          label="TVA déductible"
          value={formatEuro(estimation.tvaDeductible)}
          hint={`${estimation.nbFacturesFournisseurs} facture${estimation.nbFacturesFournisseurs > 1 ? "s" : ""} fournisseur`}
        />
        <MetricCard
          label="TVA estimée à payer"
          value={formatEuro(estimation.tvaEstimee)}
          hint="Collectée − déductible"
          emphasize
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-medium text-text-strong">Provision</h2>
        <p className="mt-1 text-sm text-text-muted">
          Indiquez le montant déjà mis de côté pour estimer le reste à
          provisionner.
        </p>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="tva-provision"
              className="mb-1.5 block text-xs font-medium text-text-muted"
            >
              Montant déjà mis de côté (€)
            </label>
            <input
              id="tva-provision"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={montantProvisionne}
              onChange={(event) => setMontantProvisionne(event.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 sm:max-w-xs"
            />
          </div>

          <div className="rounded-lg border border-border bg-page p-4">
            <p className="text-xs font-medium text-text-muted">
              Reste à provisionner
            </p>
            <p className="mt-1 text-2xl font-medium text-text-strong">
              {formatEuro(resteAProvisionnerPreview)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              TVA estimée − montant déjà mis de côté
            </p>
          </div>

          {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
          {succes && <p className="text-sm text-[#00796B]">{succes}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? "rounded-xl border border-accent/30 bg-[#E6F7F5] p-4"
          : "rounded-xl border border-border bg-card p-4"
      }
    >
      <p className="mb-1 text-xs text-text-muted">{label}</p>
      <p className="text-2xl font-medium text-text-strong">{value}</p>
      <p className="mt-1 text-xs text-[#9CA3AF]">{hint}</p>
    </div>
  );
}
