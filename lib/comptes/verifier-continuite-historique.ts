import { createAdminClient } from "@/lib/supabase/server";

export const TOLERANCE_ECART_CONTINUITE = 0.02;

export function formaterMontantFr(montant: number): string {
  return montant.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formaterDateFr(isoDate: string): string {
  const [annee, mois, jour] = isoDate.slice(0, 10).split("-");
  if (!annee || !mois || !jour) {
    return isoDate;
  }
  return `${jour}/${mois}/${annee}`;
}

export function moisPrecedent(moisCourantIso: string): string | null {
  const date = new Date(`${moisCourantIso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
}

export function ajouterJoursUtc(isoDate: string, jours: number): string | null {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

/** Nombre de jours calendaires entre deux dates (b - a). */
export function ecartJoursCalendaires(
  dateDebutIso: string,
  dateFinIso: string
): number | null {
  const debut = new Date(`${dateDebutIso.slice(0, 10)}T00:00:00.000Z`);
  const fin = new Date(`${dateFinIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
    return null;
  }

  return Math.round((fin.getTime() - debut.getTime()) / 86_400_000);
}

/**
 * Trou de période si plus d'1 jour entre la fin du relevé précédent
 * et le début du relevé courant.
 */
export function calculerPeriodeNonCouverte(params: {
  periodeFinPrecedente: string | null;
  periodeDebutCourante: string | null;
}): { debut: string; fin: string } | null {
  if (!params.periodeFinPrecedente || !params.periodeDebutCourante) {
    return null;
  }

  const ecartJours = ecartJoursCalendaires(
    params.periodeFinPrecedente,
    params.periodeDebutCourante
  );
  if (ecartJours === null || ecartJours <= 1) {
    return null;
  }

  const debut = ajouterJoursUtc(params.periodeFinPrecedente, 1);
  const fin = ajouterJoursUtc(params.periodeDebutCourante, -1);
  if (!debut || !fin || debut > fin) {
    return null;
  }

  return { debut, fin };
}

export function calculerEcartContinuite(
  soldeDebutMoisSuivant: number,
  soldeFinMoisPrecedent: number
): number {
  return (
    Math.round((soldeDebutMoisSuivant - soldeFinMoisPrecedent) * 100) / 100
  );
}

export function formaterMessageContinuite(params: {
  soldeDebut: number | null;
  soldeFinMoisPrecedent: number | null;
  ecartSolde: number | null;
  periodeNonCouverte: { debut: string; fin: string } | null;
  /** Si fourni (ex. reste recalculé), remplace le montant affiché pour un trou + écart. */
  resteAExpliquer?: number | null;
}): string | null {
  const aEcartSolde =
    params.ecartSolde !== null &&
    Math.abs(params.ecartSolde) > TOLERANCE_ECART_CONTINUITE;
  const aTrouPeriode = params.periodeNonCouverte !== null;

  if (!aEcartSolde && !aTrouPeriode) {
    return null;
  }

  const libellePeriode = aTrouPeriode
    ? `période du ${formaterDateFr(params.periodeNonCouverte!.debut)} au ${formaterDateFr(
        params.periodeNonCouverte!.fin
      )} non couverte par un relevé`
    : null;

  const montantPourTrou =
    params.resteAExpliquer !== null && params.resteAExpliquer !== undefined
      ? params.resteAExpliquer
      : params.ecartSolde;

  if (aTrouPeriode && aEcartSolde && montantPourTrou !== null) {
    return `Reste à expliquer : ${formaterMontantFr(
      Math.abs(montantPourTrou)
    )} € — ${libellePeriode}`;
  }

  if (aEcartSolde) {
    return `Écart de continuité détecté avec le mois précédent : solde de début ${formaterMontantFr(
      params.soldeDebut!
    )} € vs solde de fin du mois précédent ${formaterMontantFr(
      params.soldeFinMoisPrecedent!
    )} € (écart ${formaterMontantFr(Math.abs(params.ecartSolde!))} €).`;
  }

  return `Trou de période détecté avec le mois précédent : ${libellePeriode}.`;
}

export interface MetadonneesAlerteContinuite {
  compteId: string;
  ecartContinuite: number | null;
  periodeNonCouverte: { debut: string; fin: string } | null;
}

interface LigneHistoriqueContinuite {
  compte_id: string;
  mois: string;
  solde_debut: number | null;
  solde_fin: number | null;
  periode_debut: string | null;
  periode_fin: string | null;
  document_id: string | null;
}

export interface ResultatVerificationContinuiteLot {
  documentsMarques: number;
  alertes: string[];
}

/**
 * Re-vérifie la continuité inter-mois sur l'historique des comptes donnés
 * (après un lot rétroactif, l'ordre d'import n'est plus un problème).
 */
export async function verifierContinuiteApresLot(params: {
  organisationId: string;
  compteIds: string[];
}): Promise<ResultatVerificationContinuiteLot> {
  const compteIds = [...new Set(params.compteIds.filter(Boolean))];
  const alertes: string[] = [];
  let documentsMarques = 0;

  if (compteIds.length === 0) {
    return { documentsMarques: 0, alertes };
  }

  const admin = createAdminClient();

  const { data: comptesAutorises, error: comptesError } = await admin
    .from("comptes_bancaires")
    .select("id")
    .eq("organisation_id", params.organisationId)
    .in("id", compteIds);

  if (comptesError) {
    throw new Error(comptesError.message);
  }

  const idsAutorises = (comptesAutorises ?? []).map((compte) => compte.id);
  if (idsAutorises.length === 0) {
    return { documentsMarques: 0, alertes };
  }

  const { data: lignesBrutes, error: historiqueError } = await admin
    .from("historique_solde_mensuel")
    .select(
      "compte_id, mois, solde_debut, solde_fin, periode_debut, periode_fin, document_id"
    )
    .eq("organisation_id", params.organisationId)
    .in("compte_id", idsAutorises)
    .order("mois", { ascending: true });

  if (historiqueError) {
    throw new Error(historiqueError.message);
  }

  const parCompte = new Map<string, LigneHistoriqueContinuite[]>();

  for (const ligne of lignesBrutes ?? []) {
    const normalisee: LigneHistoriqueContinuite = {
      compte_id: ligne.compte_id,
      mois: String(ligne.mois).slice(0, 10),
      solde_debut:
        ligne.solde_debut === null || ligne.solde_debut === undefined
          ? null
          : Number(ligne.solde_debut),
      solde_fin:
        ligne.solde_fin === null || ligne.solde_fin === undefined
          ? null
          : Number(ligne.solde_fin),
      periode_debut: ligne.periode_debut
        ? String(ligne.periode_debut).slice(0, 10)
        : null,
      periode_fin: ligne.periode_fin
        ? String(ligne.periode_fin).slice(0, 10)
        : null,
      document_id: ligne.document_id ?? null,
    };

    const existantes = parCompte.get(normalisee.compte_id) ?? [];
    existantes.push(normalisee);
    parCompte.set(normalisee.compte_id, existantes);
  }

  for (const [compteId, lignes] of parCompte) {
    for (let index = 0; index < lignes.length - 1; index += 1) {
      const moisPrecedentLigne = lignes[index];
      const moisSuivantLigne = lignes[index + 1];

      const peutComparerSoldes =
        moisPrecedentLigne.solde_fin !== null &&
        moisSuivantLigne.solde_debut !== null;

      if (!peutComparerSoldes) {
        console.warn(
          "[releve] Continuité lot : soldes incomplets pour la paire de mois.",
          {
            compteId,
            moisPrecedent: moisPrecedentLigne.mois,
            moisSuivant: moisSuivantLigne.mois,
            soldeFinPrecedent: moisPrecedentLigne.solde_fin,
            soldeDebutSuivant: moisSuivantLigne.solde_debut,
          }
        );
      }

      const ecartSolde = peutComparerSoldes
        ? calculerEcartContinuite(
            moisSuivantLigne.solde_debut!,
            moisPrecedentLigne.solde_fin!
          )
        : null;

      const periodeNonCouverte = calculerPeriodeNonCouverte({
        periodeFinPrecedente: moisPrecedentLigne.periode_fin,
        periodeDebutCourante: moisSuivantLigne.periode_debut,
      });

      const message = formaterMessageContinuite({
        soldeDebut: moisSuivantLigne.solde_debut,
        soldeFinMoisPrecedent: moisPrecedentLigne.solde_fin,
        ecartSolde,
        periodeNonCouverte,
      });

      if (!message) {
        continue;
      }

      if (!moisSuivantLigne.document_id) {
        console.warn(
          "[releve] Continuité lot : écart détecté mais document_id manquant.",
          {
            compteId,
            mois: moisSuivantLigne.mois,
            ecartSolde,
            periodeNonCouverte,
          }
        );
        alertes.push(
          `Compte ${compteId.slice(0, 8)}… (${moisSuivantLigne.mois}) : ${message}`
        );
        continue;
      }

      const { data: document, error: documentError } = await admin
        .from("documents")
        .select("id, nom_original")
        .eq("id", moisSuivantLigne.document_id)
        .eq("organisation_id", params.organisationId)
        .maybeSingle();

      if (documentError) {
        throw new Error(documentError.message);
      }

      if (!document) {
        console.warn(
          "[releve] Continuité lot : document introuvable pour marquage.",
          { documentId: moisSuivantLigne.document_id, compteId }
        );
        alertes.push(message);
        continue;
      }

      const aEcartSolde =
        ecartSolde !== null &&
        Math.abs(ecartSolde) > TOLERANCE_ECART_CONTINUITE;

      const { error: updateError } = await admin
        .from("documents")
        .update({
          necessite_verification: true,
          verification_message: message,
          verification_compte_id: compteId,
          verification_trou_debut: periodeNonCouverte?.debut ?? null,
          verification_trou_fin: periodeNonCouverte?.fin ?? null,
          verification_ecart_continuite: aEcartSolde ? ecartSolde : null,
        })
        .eq("id", document.id)
        .eq("organisation_id", params.organisationId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      documentsMarques += 1;
      alertes.push(`${document.nom_original} : ${message}`);
    }
  }

  return { documentsMarques, alertes };
}
