"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { SignatureModal } from "@/components/prestations/signature-modal";
import {
  acceptPrestation,
  updatePrestationStatut,
} from "@/lib/prestations/actions";
import type { PrestationDetailMobile } from "@/lib/prestations/get-prestations";
import {
  devisBloqueDemarrage,
  formatHeureSouhaitee,
  getNomMajeur,
  getNomOrganisation,
  getStatutPrestationBadgeVariant,
  getStatutPrestationLabel,
  MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER,
} from "@/lib/prestations/utils";
import { formatDateAffichage } from "@/lib/utils/date";
import type { AdminRole } from "@/types/admin";
import type { StatutPrestation } from "@/types";

interface MobilePrestationDetailProps {
  prestation: PrestationDetailMobile;
  currentUserRole: AdminRole;
}

function InfoLigne({
  label,
  valeur,
}: {
  label: string;
  valeur: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-[#9CA3AF]">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-strong">
        {valeur}
      </p>
    </div>
  );
}

function valeurOuTiret(valeur: string | null | undefined): string {
  const texte = valeur?.trim();
  return texte && texte.length > 0 ? texte : "—";
}

export function MobilePrestationDetail({
  prestation: prestationInitiale,
  currentUserRole,
}: MobilePrestationDetailProps) {
  const router = useRouter();
  const [prestation, setPrestation] =
    useState<PrestationDetailMobile>(prestationInitiale);
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  const dateAffichee = formatDateAffichage(prestation.date_souhaitee);
  const heure = formatHeureSouhaitee(prestation.heure_souhaitee);
  const dateHeure = [dateAffichee, heure !== "—" ? heure : null]
    .filter(Boolean)
    .join(" · ");

  const demarrageBloqueParDevis = devisBloqueDemarrage(prestation);
  const devisPath =
    prestation.devis_signe_storage_path?.trim() ||
    prestation.devis_storage_path?.trim() ||
    null;
  const devisSigne = Boolean(prestation.devis_signe_storage_path?.trim());
  const attestationPath = prestation.attestation_url?.trim() || null;

  const peutAgirSurStatut =
    currentUserRole === "admin" || currentUserRole === "prestataire";

  function appliquerStatutLocal(statut: StatutPrestation) {
    setPrestation((actuelle) => ({ ...actuelle, statut }));
  }

  function handleAccepter() {
    setErreur(null);
    startTransition(async () => {
      const result =
        currentUserRole === "prestataire"
          ? await acceptPrestation(prestation.id)
          : await updatePrestationStatut(prestation.id, "confirme");

      if (!result.success) {
        setErreur(result.error ?? "Impossible d'accepter la prestation.");
        return;
      }

      appliquerStatutLocal("confirme");
      router.refresh();
    });
  }

  function handlePasserEnCours() {
    if (demarrageBloqueParDevis) {
      setErreur(MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER);
      return;
    }

    setErreur(null);
    startTransition(async () => {
      const result = await updatePrestationStatut(prestation.id, "en_cours");
      if (!result.success) {
        setErreur(result.error ?? "Impossible de démarrer la prestation.");
        return;
      }

      appliquerStatutLocal("en_cours");
      router.refresh();
    });
  }

  function handleAttestationSuccess() {
    setPrestation((actuelle) => ({
      ...actuelle,
      statut: "realise",
      attestation_url:
        actuelle.attestation_url ?? `attestations/${actuelle.id}.pdf`,
      statut_facturation: "a_facturer",
    }));
    setSignatureOpen(false);
    setErreur(null);
    router.refresh();
  }

  return (
    <>
      <div className="space-y-5">
        <div>
          <Link
            href="/m/prestations"
            className="inline-flex items-center gap-1.5 text-sm text-accent transition-colors active:text-[#00796B]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Prestations
          </Link>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-text-strong">
              {getNomMajeur(prestation.majeurs)}
            </h1>
            <Badge
              variant={getStatutPrestationBadgeVariant(prestation.statut)}
              className="shrink-0"
            >
              {getStatutPrestationLabel(prestation.statut)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {getNomOrganisation(prestation.organisations)}
          </p>
        </div>

        <section
          aria-labelledby="prestation-infos-titre"
          className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
        >
          <h2 id="prestation-infos-titre" className="sr-only">
            Détail de la prestation
          </h2>
          <InfoLigne
            label="Protégé"
            valeur={getNomMajeur(prestation.majeurs)}
          />
          <InfoLigne
            label="Description"
            valeur={valeurOuTiret(prestation.description)}
          />
          <InfoLigne
            label="Adresse d'intervention"
            valeur={valeurOuTiret(prestation.adresse_intervention)}
          />
          <InfoLigne
            label="Date et heure souhaitées"
            valeur={dateHeure || "—"}
          />
          <InfoLigne
            label="Statut"
            valeur={getStatutPrestationLabel(prestation.statut)}
          />
          <InfoLigne
            label="Prestataire assigné"
            valeur={prestation.prestataireNom ?? "Non assigné"}
          />
          {prestation.instructions?.trim() ? (
            <InfoLigne
              label="Instructions"
              valeur={prestation.instructions.trim()}
            />
          ) : null}
          {devisPath ? (
            <div className="px-4 py-3">
              <p className="text-xs text-[#9CA3AF]">Devis</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={devisSigne ? "success" : "info"}>
                  {devisSigne ? "Devis signé" : "Devis joint"}
                </Badge>
                <a
                  href={`/api/storage/sign?path=${encodeURIComponent(devisPath)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-accent"
                >
                  {devisSigne
                    ? "Consulter le devis signé"
                    : "Consulter le devis"}
                </a>
              </div>
            </div>
          ) : null}
          {attestationPath ? (
            <div className="px-4 py-3">
              <p className="text-xs text-[#9CA3AF]">Attestation</p>
              <a
                href={`/api/storage/sign?path=${encodeURIComponent(attestationPath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex text-sm font-medium text-accent"
              >
                Consulter l&apos;attestation
              </a>
            </div>
          ) : null}
        </section>

        {peutAgirSurStatut && (
          <div className="space-y-2">
            {prestation.statut === "en_attente" && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleAccepter}
                className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Acceptation…" : "Accepter"}
              </button>
            )}

            {prestation.statut === "confirme" && (
              <>
                <button
                  type="button"
                  disabled={isPending || demarrageBloqueParDevis}
                  title={
                    demarrageBloqueParDevis
                      ? MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER
                      : undefined
                  }
                  onClick={handlePasserEnCours}
                  className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Mise à jour…" : "Passer en cours"}
                </button>
                {demarrageBloqueParDevis && (
                  <p className="text-xs text-[#B45309]">
                    {MESSAGE_DEVIS_NON_SIGNE_POUR_DEMARRER}
                  </p>
                )}
              </>
            )}

            {prestation.statut === "en_cours" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setErreur(null);
                  setSignatureOpen(true);
                }}
                className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Signer l&apos;attestation
              </button>
            )}

            {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
          </div>
        )}
      </div>

      {peutAgirSurStatut && (
        <SignatureModal
          open={signatureOpen}
          prestationId={prestation.id}
          onClose={() => setSignatureOpen(false)}
          onSuccess={handleAttestationSuccess}
        />
      )}
    </>
  );
}
