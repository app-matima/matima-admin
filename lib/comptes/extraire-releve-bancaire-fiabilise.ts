import {
  extraireReleveBancaire,
  type ReleveBancaireExtrait,
} from "@/lib/comptes/extraire-releve-bancaire";

const TOLERANCE_ECART_SOLDE = 0.02;

export const MESSAGE_DIVERGENCE_TRIPLE_LECTURE =
  "Trois lectures indépendantes ont donné des résultats différents — document probablement difficile à lire, vérification manuelle nécessaire.";

export interface ResultatExtractionReleveFiabilise extends ReleveBancaireExtrait {
  necessiteVerification: boolean;
  ecartSolde: number | null;
  messageVerification: string | null;
}

interface SignatureLecture {
  nombreTransactions: number;
  sommeMontants: number;
}

function calculerSommeMontantsSignes(releve: ReleveBancaireExtrait): number {
  const somme = releve.transactions.reduce((acc, transaction) => {
    return (
      acc +
      (transaction.sens === "credit" ? transaction.montant : -transaction.montant)
    );
  }, 0);

  return Math.round(somme * 100) / 100;
}

function calculerSignature(releve: ReleveBancaireExtrait): SignatureLecture {
  return {
    nombreTransactions: releve.transactions.length,
    sommeMontants: calculerSommeMontantsSignes(releve),
  };
}

function signaturesConcordent(a: SignatureLecture, b: SignatureLecture): boolean {
  return (
    a.nombreTransactions === b.nombreTransactions &&
    Math.abs(a.sommeMontants - b.sommeMontants) <= 0.001
  );
}

function choisirLectureMajoritaire(lectures: ReleveBancaireExtrait[]): {
  releve: ReleveBancaireExtrait;
  lecturesDivergentes: boolean;
} {
  const signatures = lectures.map(calculerSignature);

  const paires: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  for (const [indexA, indexB] of paires) {
    if (signaturesConcordent(signatures[indexA], signatures[indexB])) {
      return {
        releve: lectures[indexA],
        lecturesDivergentes: false,
      };
    }
  }

  return {
    releve: lectures[0],
    lecturesDivergentes: true,
  };
}

/** solde_fin - (solde_debut + crédits - débits) */
export function calculerEcartSoldeReleve(
  releve: ReleveBancaireExtrait
): number | null {
  if (releve.soldeDebut === null || releve.soldeFin === null) {
    return null;
  }

  const credits = releve.transactions
    .filter((transaction) => transaction.sens === "credit")
    .reduce((acc, transaction) => acc + transaction.montant, 0);

  const debits = releve.transactions
    .filter((transaction) => transaction.sens === "debit")
    .reduce((acc, transaction) => acc + transaction.montant, 0);

  const soldeAttendu = releve.soldeDebut + credits - debits;
  const ecart = releve.soldeFin - soldeAttendu;

  return Math.round(ecart * 100) / 100;
}

export function coherenceSoldeReleveValidee(
  releve: ReleveBancaireExtrait
): boolean {
  const ecart = calculerEcartSoldeReleve(releve);
  if (ecart === null) {
    return true;
  }

  return Math.abs(ecart) <= TOLERANCE_ECART_SOLDE;
}

function formaterMessageEcartSolde(ecart: number): string {
  const montant = Math.abs(ecart).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `Écart de solde de ${montant} € détecté (solde début + opérations ≠ solde fin).`;
}

function finaliserResultat(
  releve: ReleveBancaireExtrait,
  options: {
    lecturesDivergentes: boolean;
  }
): ResultatExtractionReleveFiabilise {
  let necessiteVerification = options.lecturesDivergentes;
  let messageVerification: string | null = options.lecturesDivergentes
    ? MESSAGE_DIVERGENCE_TRIPLE_LECTURE
    : null;

  const ecartSolde = calculerEcartSoldeReleve(releve);
  const coherenceSolde = coherenceSoldeReleveValidee(releve);

  if (!coherenceSolde && ecartSolde !== null) {
    necessiteVerification = true;
    messageVerification = formaterMessageEcartSolde(ecartSolde);
  }

  return {
    ...releve,
    coherenceValidee: coherenceSolde,
    necessiteVerification,
    ecartSolde,
    messageVerification,
  };
}

/**
 * Extraction progressive : une lecture d'abord ; si la cohérence de solde
 * échoue, deux lectures supplémentaires + vote majoritaire sur les 3.
 */
export async function extraireReleveBancaireFiabilise(
  pdfBase64: string
): Promise<ResultatExtractionReleveFiabilise> {
  const premiereLecture = await extraireReleveBancaire(pdfBase64);

  if (coherenceSoldeReleveValidee(premiereLecture)) {
    return finaliserResultat(premiereLecture, { lecturesDivergentes: false });
  }

  const lecturesSupplementaires = await Promise.all([
    extraireReleveBancaire(pdfBase64),
    extraireReleveBancaire(pdfBase64),
  ]);

  const { releve, lecturesDivergentes } = choisirLectureMajoritaire([
    premiereLecture,
    lecturesSupplementaires[0],
    lecturesSupplementaires[1],
  ]);

  return finaliserResultat(releve, { lecturesDivergentes });
}
