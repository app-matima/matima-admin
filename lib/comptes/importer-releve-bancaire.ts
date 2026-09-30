import { createHash } from "crypto";
import {
  categoriserNouvelleTransaction,
  preparerContexteCategorisation,
} from "@/lib/comptes/categoriser-nouvelles-transactions";
import type { ResultatImportReleve } from "@/lib/comptes/releve-bancaire-types";
import {
  extraireReleveBancaireFiabilise,
  type ResultatExtractionReleveFiabilise,
} from "@/lib/comptes/extraire-releve-bancaire-fiabilise";
import { CHAMPS_META_VERIFICATION_VIDES } from "@/lib/comptes/reste-a-expliquer-trou";
import {
  calculerEcartContinuite,
  calculerPeriodeNonCouverte,
  formaterMessageContinuite,
  moisPrecedent,
  TOLERANCE_ECART_CONTINUITE,
} from "@/lib/comptes/verifier-continuite-historique";
import { isPdf } from "@/lib/documents/document-utils";
import { estDossierBancaire } from "@/lib/documents/est-dossier-bancaire";
import { createAdminClient } from "@/lib/supabase/server";
import type { TypeTransaction } from "@/types";

const BUCKET = "documents";
const TAILLE_LOT_CATEGORISATION = 5;

export type { ResultatImportReleve };

interface DocumentPourImport {
  id: string;
  organisation_id: string;
  majeur_id: string;
  ged_dossier_id: string;
  type_document: string;
  storage_path: string;
}

interface TransactionACategoriser {
  transactionId: string;
  libelleBrut: string;
  type: TypeTransaction;
}

function normaliserNumeroCompte(valeur: string): string {
  return valeur.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normaliserIban(valeur: string): string {
  return valeur.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function normaliserNomBanque(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function determinerTypeTransaction(montantSigne: number): TypeTransaction {
  return montantSigne > 0 ? "revenu" : "depense";
}

function idTransactionReleve(
  documentId: string,
  index: number,
  date: string,
  montant: number,
  sens: string,
  libelle: string
): string {
  const raw = `${documentId}|${index}|${date}|${montant}|${sens}|${libelle}`;
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
  return `releve_${hash}`;
}

export async function marquerDocumentReleveTraite(
  documentId: string,
  metadonnees?: {
    necessiteVerification: boolean;
    ecartSolde: number | null;
    verificationMessage?: string | null;
    verificationCompteId?: string | null;
    verificationTrouDebut?: string | null;
    verificationTrouFin?: string | null;
    verificationEcartContinuite?: number | null;
  }
): Promise<void> {
  const admin = createAdminClient();
  const metaContinuite =
    metadonnees?.necessiteVerification && metadonnees.verificationCompteId
      ? {
          verification_compte_id: metadonnees.verificationCompteId,
          verification_trou_debut: metadonnees.verificationTrouDebut ?? null,
          verification_trou_fin: metadonnees.verificationTrouFin ?? null,
          verification_ecart_continuite:
            metadonnees.verificationEcartContinuite ?? null,
        }
      : CHAMPS_META_VERIFICATION_VIDES;

  const { error } = await admin
    .from("documents")
    .update({
      releve_traite: true,
      necessite_verification: metadonnees?.necessiteVerification ?? false,
      verification_message: metadonnees?.verificationMessage ?? null,
      ecart_solde: metadonnees?.ecartSolde ?? null,
      ...metaContinuite,
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(error.message);
  }
}

async function setExtractionEnCours(
  documentId: string,
  enCours: boolean
): Promise<void> {
  const admin = createAdminClient();
  const maintenant = new Date().toISOString();
  const { error } = await admin
    .from("documents")
    .update({
      extraction_en_cours: enCours,
      extraction_demarrage_at: enCours ? maintenant : null,
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(error.message);
  }
}

async function dossierImmediatEstReleve(
  admin: ReturnType<typeof createAdminClient>,
  gedDossierId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("ged_dossiers")
    .select("nom")
    .eq("id", gedDossierId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return estDossierBancaire(data.nom);
}

async function resoudreOuCreerCompte(params: {
  admin: ReturnType<typeof createAdminClient>;
  organisationId: string;
  majeurId: string;
  releve: ResultatExtractionReleveFiabilise;
  documentId: string;
}): Promise<string> {
  const numeroCompte = params.releve.numeroCompte;
  const numeroCompteNormalise = numeroCompte
    ? normaliserNumeroCompte(numeroCompte)
    : null;
  const iban = params.releve.iban;
  const ibanNormalise = iban ? normaliserIban(iban) : null;
  const banqueNormalisee = params.releve.banque
    ? normaliserNomBanque(params.releve.banque)
    : null;

  const mettreAJourCompteExistant = async (
    compteId: string
  ): Promise<void> => {
    const miseAJour: {
      banque?: string;
      iban?: string | null;
      numero_compte?: string | null;
      solde_actuel?: number;
    } = {};

    if (params.releve.banque) {
      miseAJour.banque = params.releve.banque;
    }
    if (params.releve.iban) {
      miseAJour.iban = params.releve.iban;
    }
    if (params.releve.numeroCompte) {
      miseAJour.numero_compte = params.releve.numeroCompte;
    }
    if (params.releve.soldeFin !== null) {
      miseAJour.solde_actuel = params.releve.soldeFin;
    }

    if (Object.keys(miseAJour).length === 0) {
      return;
    }

    const { error } = await params.admin
      .from("comptes_bancaires")
      .update(miseAJour)
      .eq("id", compteId);

    if (error) {
      throw new Error(error.message);
    }
  };

  if (numeroCompte && numeroCompteNormalise) {
    const { data: comptesMajeur, error: comptesError } = await params.admin
      .from("comptes_bancaires")
      .select("id, numero_compte")
      .eq("majeur_id", params.majeurId)
      .not("numero_compte", "is", null);

    if (comptesError) {
      throw new Error(comptesError.message);
    }

    const existantParNumero = (comptesMajeur ?? []).find((compte) => {
      if (!compte.numero_compte) {
        return false;
      }
      return (
        normaliserNumeroCompte(compte.numero_compte) === numeroCompteNormalise
      );
    });

    if (existantParNumero?.id) {
      await mettreAJourCompteExistant(existantParNumero.id);
      return existantParNumero.id;
    }
  }

  if (iban && ibanNormalise) {
    const { data: comptesMajeur, error: comptesError } = await params.admin
      .from("comptes_bancaires")
      .select("id, iban")
      .eq("majeur_id", params.majeurId)
      .not("iban", "is", null);

    if (comptesError) {
      throw new Error(comptesError.message);
    }

    const existantParIban = (comptesMajeur ?? []).find((compte) => {
      if (!compte.iban) {
        return false;
      }
      return normaliserIban(compte.iban) === ibanNormalise;
    });

    if (existantParIban?.id) {
      await mettreAJourCompteExistant(existantParIban.id);
      return existantParIban.id;
    }
  }

  if (!numeroCompteNormalise && !ibanNormalise && banqueNormalisee) {
    const { data: comptesMajeur, error: comptesError } = await params.admin
      .from("comptes_bancaires")
      .select("id, banque")
      .eq("majeur_id", params.majeurId);

    if (comptesError) {
      throw new Error(comptesError.message);
    }

    const comptesMemeBanque = (comptesMajeur ?? []).filter((compte) => {
      if (!compte.banque) {
        return false;
      }
      return normaliserNomBanque(compte.banque) === banqueNormalisee;
    });

    if (comptesMemeBanque.length === 1) {
      await mettreAJourCompteExistant(comptesMemeBanque[0].id);
      return comptesMemeBanque[0].id;
    }
  }

  const identifiantCompteExterne = numeroCompteNormalise
    ? `releve:num:${numeroCompteNormalise}`
    : ibanNormalise
      ? `releve:iban:${ibanNormalise}`
      : `releve:doc:${params.documentId}`;

  const { data: cree, error } = await params.admin
    .from("comptes_bancaires")
    .insert({
      organisation_id: params.organisationId,
      majeur_id: params.majeurId,
      type_compte: "courant",
      banque: params.releve.banque?.trim() || "Banque inconnue",
      iban: params.releve.iban,
      numero_compte: numeroCompte,
      solde_actuel: params.releve.soldeFin ?? 0,
      bridge_account_id: identifiantCompteExterne,
      nom_bridge: null,
    })
    .select("id")
    .single();

  if (error || !cree) {
    throw new Error(error?.message ?? "Impossible de créer le compte bancaire.");
  }

  return cree.id;
}

/**
 * Mois calendaire couvert par le relevé (premier jour du mois),
 * dérivé de la date de fin de période (période_fin ou max des dates de transactions).
 */
function moisCalendaireDepuisReleve(
  releve: ResultatExtractionReleveFiabilise
): string | null {
  let dateFinPeriode: string | null =
    releve.periodeFin && /^\d{4}-\d{2}-\d{2}$/.test(releve.periodeFin)
      ? releve.periodeFin
      : null;

  if (!dateFinPeriode) {
    for (const transaction of releve.transactions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) {
        continue;
      }
      if (!dateFinPeriode || transaction.date > dateFinPeriode) {
        dateFinPeriode = transaction.date;
      }
    }
  }

  if (!dateFinPeriode) {
    return null;
  }

  return `${dateFinPeriode.slice(0, 7)}-01`;
}

async function verifierContinuiteMoisPrecedent(params: {
  admin: ReturnType<typeof createAdminClient>;
  compteId: string;
  releve: ResultatExtractionReleveFiabilise;
}): Promise<{
  necessiteVerificationContinuite: boolean;
  messageContinuite: string | null;
  metadonneesContinuite: {
    compteId: string;
    ecartContinuite: number | null;
    periodeNonCouverte: { debut: string; fin: string } | null;
  } | null;
}> {
  const vide = {
    necessiteVerificationContinuite: false,
    messageContinuite: null,
    metadonneesContinuite: null,
  };

  if (params.releve.soldeDebut === null) {
    console.warn(
      "[releve] Continuité inter-mois ignorée : solde_debut absent ou illisible.",
      { compteId: params.compteId }
    );
    return vide;
  }

  const moisCourant = moisCalendaireDepuisReleve(params.releve);
  if (!moisCourant) {
    console.warn(
      "[releve] Continuité inter-mois ignorée : impossible de dériver le mois calendaire du relevé (aucune date de transaction valide).",
      { compteId: params.compteId, soldeDebut: params.releve.soldeDebut }
    );
    return vide;
  }

  const moisPrec = moisPrecedent(moisCourant);
  if (!moisPrec) {
    console.warn(
      "[releve] Continuité inter-mois ignorée : calcul du mois précédent impossible.",
      { compteId: params.compteId, moisCourant }
    );
    return vide;
  }

  const { data: historiquePrecedent, error } = await params.admin
    .from("historique_solde_mensuel")
    .select("solde_fin, periode_fin")
    .eq("compte_id", params.compteId)
    .eq("mois", moisPrec)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!historiquePrecedent) {
    console.warn(
      "[releve] Continuité inter-mois ignorée : aucune entrée historique_solde_mensuel pour le mois précédent.",
      { compteId: params.compteId, moisPrecedent: moisPrec, moisCourant }
    );
    return vide;
  }

  if (historiquePrecedent.solde_fin === null) {
    console.warn(
      "[releve] Continuité inter-mois ignorée : solde_fin du mois précédent absent.",
      {
        compteId: params.compteId,
        moisPrecedent: moisPrec,
        soldeDebutReleve: params.releve.soldeDebut,
      }
    );
    return vide;
  }

  const soldeFinMoisPrecedent = Number(historiquePrecedent.solde_fin);
  const ecartContinuite = calculerEcartContinuite(
    params.releve.soldeDebut,
    soldeFinMoisPrecedent
  );

  const periodeFinPrecedente = historiquePrecedent.periode_fin
    ? String(historiquePrecedent.periode_fin).slice(0, 10)
    : null;
  const periodeNonCouverte = calculerPeriodeNonCouverte({
    periodeFinPrecedente,
    periodeDebutCourante: params.releve.periodeDebut,
  });

  const messageContinuite = formaterMessageContinuite({
    soldeDebut: params.releve.soldeDebut,
    soldeFinMoisPrecedent,
    ecartSolde: ecartContinuite,
    periodeNonCouverte,
  });

  if (!messageContinuite) {
    return vide;
  }

  const aEcartSolde = Math.abs(ecartContinuite) > TOLERANCE_ECART_CONTINUITE;

  return {
    necessiteVerificationContinuite: true,
    messageContinuite,
    metadonneesContinuite: {
      compteId: params.compteId,
      ecartContinuite: aEcartSolde ? ecartContinuite : null,
      periodeNonCouverte,
    },
  };
}

async function upsertHistoriqueSoldeMensuel(params: {
  admin: ReturnType<typeof createAdminClient>;
  organisationId: string;
  majeurId: string;
  compteId: string;
  documentId: string;
  releve: ResultatExtractionReleveFiabilise;
}): Promise<void> {
  if (params.releve.soldeFin === null) {
    return;
  }

  const mois = moisCalendaireDepuisReleve(params.releve);
  if (!mois) {
    console.warn(
      "[releve] Historique solde non enregistré : impossible de dériver le mois du relevé."
    );
    return;
  }

  const maintenant = new Date().toISOString();
  const { error } = await params.admin.from("historique_solde_mensuel").upsert(
    {
      organisation_id: params.organisationId,
      majeur_id: params.majeurId,
      compte_id: params.compteId,
      document_id: params.documentId,
      mois,
      solde_debut: params.releve.soldeDebut,
      solde_fin: params.releve.soldeFin,
      periode_debut: params.releve.periodeDebut,
      periode_fin: params.releve.periodeFin,
      updated_at: maintenant,
    },
    { onConflict: "compte_id,mois" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

function fusionnerCategories(
  categories: Awaited<ReturnType<typeof preparerContexteCategorisation>>["categories"],
  categoriesAjoutees: Awaited<
    ReturnType<typeof preparerContexteCategorisation>
  >["categories"][number][]
): Awaited<ReturnType<typeof preparerContexteCategorisation>>["categories"] {
  const parId = new Map(categories.map((categorie) => [categorie.id, categorie]));

  for (const categorie of categoriesAjoutees) {
    parId.set(categorie.id, categorie);
  }

  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

async function categoriserTransactionsParLots(params: {
  contexte: Awaited<ReturnType<typeof preparerContexteCategorisation>>;
  majeurId: string;
  transactionsACategoriser: TransactionACategoriser[];
}): Promise<void> {
  let categories = params.contexte.categories;

  for (
    let debut = 0;
    debut < params.transactionsACategoriser.length;
    debut += TAILLE_LOT_CATEGORISATION
  ) {
    const lot = params.transactionsACategoriser.slice(
      debut,
      debut + TAILLE_LOT_CATEGORISATION
    );

    const categoriesLot = await Promise.all(
      lot.map((transaction) =>
        categoriserNouvelleTransaction({
          admin: params.contexte.admin,
          majeurId: params.majeurId,
          transactionId: transaction.transactionId,
          libelleBrut: transaction.libelleBrut,
          type: transaction.type,
          categories,
          transactionsLibellesValides: params.contexte.transactionsLibellesValides,
        })
      )
    );

    categories = fusionnerCategories(
      categories,
      categoriesLot.flatMap((liste) => liste)
    );
  }
}

/**
 * Importe un relevé déjà extrait (ou extrait depuis le PDF fourni).
 */
export async function importerReleveBancaire(params: {
  document: DocumentPourImport;
  pdfBase64: string;
  releve?: ResultatExtractionReleveFiabilise;
}): Promise<ResultatImportReleve> {
  await setExtractionEnCours(params.document.id, true);

  try {
    return await executerImportReleveBancaire(params);
  } finally {
    try {
      await setExtractionEnCours(params.document.id, false);
    } catch (erreurLiberation) {
      console.error(
        "[releve] Impossible de libérer extraction_en_cours:",
        erreurLiberation
      );
    }
  }
}

async function executerImportReleveBancaire(params: {
  document: DocumentPourImport;
  pdfBase64: string;
  releve?: ResultatExtractionReleveFiabilise;
}): Promise<ResultatImportReleve> {
  const admin = createAdminClient();
  const releve =
    params.releve ?? (await extraireReleveBancaireFiabilise(params.pdfBase64));

  const compteId = await resoudreOuCreerCompte({
    admin,
    organisationId: params.document.organisation_id,
    majeurId: params.document.majeur_id,
    releve,
    documentId: params.document.id,
  });

  await upsertHistoriqueSoldeMensuel({
    admin,
    organisationId: params.document.organisation_id,
    majeurId: params.document.majeur_id,
    compteId,
    documentId: params.document.id,
    releve,
  });

  const contexte = await preparerContexteCategorisation(
    params.document.majeur_id
  );
  let transactionsImportees = 0;
  let transactionsIgnoreesDoublon = 0;
  const transactionsACategoriser: TransactionACategoriser[] = [];

  for (let index = 0; index < releve.transactions.length; index += 1) {
    const ligne = releve.transactions[index];
    const montantSigne =
      ligne.sens === "credit" ? ligne.montant : -ligne.montant;
    const type = determinerTypeTransaction(montantSigne);
    const libelleBrut = ligne.libelle;
    const identifiantTransactionExterne = idTransactionReleve(
      params.document.id,
      index,
      ligne.date,
      ligne.montant,
      ligne.sens,
      libelleBrut
    );

    const { data: existante } = await admin
      .from("transactions")
      .select("id")
      .eq("bridge_transaction_id", identifiantTransactionExterne)
      .maybeSingle();

    if (existante) {
      continue;
    }

    const { data: doublonParLibelle } = await admin
      .from("transactions")
      .select("id")
      .eq("compte_id", compteId)
      .eq("date_transaction", ligne.date)
      .eq("montant", montantSigne)
      .eq("libelle", libelleBrut)
      .limit(1)
      .maybeSingle();

    if (doublonParLibelle) {
      transactionsIgnoreesDoublon += 1;
      continue;
    }

    const { data: doublonParLibelleBrut } = await admin
      .from("transactions")
      .select("id")
      .eq("compte_id", compteId)
      .eq("date_transaction", ligne.date)
      .eq("montant", montantSigne)
      .eq("libelle_brut", libelleBrut)
      .limit(1)
      .maybeSingle();

    if (doublonParLibelleBrut) {
      transactionsIgnoreesDoublon += 1;
      continue;
    }

    const { data: inseree, error: insertError } = await admin
      .from("transactions")
      .insert({
        majeur_id: params.document.majeur_id,
        compte_id: compteId,
        bridge_transaction_id: identifiantTransactionExterne,
        montant: montantSigne,
        type,
        date_transaction: ligne.date,
        libelle: libelleBrut,
        libelle_brut: libelleBrut,
        categorie_validee: false,
        source: "releve",
      })
      .select("id")
      .single();

    if (insertError || !inseree) {
      throw new Error(
        insertError?.message ?? "Impossible d'enregistrer la transaction."
      );
    }

    transactionsACategoriser.push({
      transactionId: inseree.id,
      libelleBrut,
      type,
    });

    transactionsImportees += 1;
  }

  await categoriserTransactionsParLots({
    contexte,
    majeurId: params.document.majeur_id,
    transactionsACategoriser,
  });

  const {
    necessiteVerificationContinuite,
    messageContinuite,
    metadonneesContinuite,
  } = await verifierContinuiteMoisPrecedent({
    admin,
    compteId,
    releve,
  });

  const necessiteVerification = Boolean(
    releve.necessiteVerification || necessiteVerificationContinuite
  );
  const messageVerification = messageContinuite ?? releve.messageVerification;

  await marquerDocumentReleveTraite(params.document.id, {
    necessiteVerification,
    verificationMessage: messageVerification,
    ecartSolde: releve.ecartSolde,
    verificationCompteId: metadonneesContinuite?.compteId ?? null,
    verificationTrouDebut:
      metadonneesContinuite?.periodeNonCouverte?.debut ?? null,
    verificationTrouFin:
      metadonneesContinuite?.periodeNonCouverte?.fin ?? null,
    verificationEcartContinuite:
      metadonneesContinuite?.ecartContinuite ?? null,
  });

  return {
    ignore: false,
    transactionsImportees,
    transactionsIgnoreesDoublon,
    lignesRejetees: releve.lignesRejetees,
    coherenceValidee: releve.coherenceValidee,
    qualiteLisible: releve.qualiteLisible,
    zonesIncertaines: releve.zonesIncertaines,
    necessiteVerification,
    ecartSolde: releve.ecartSolde,
    messageVerification,
    banque: releve.banque,
    numeroCompte: releve.numeroCompte,
    compteId,
  };
}

/**
 * Si le document est un PDF classé dans un dossier de relevés (nom immédiat),
 * extrait le relevé et importe les transactions.
 */
export async function importerReleveBancaireDepuisDocument(
  documentId: string
): Promise<ResultatImportReleve> {
  const admin = createAdminClient();

  const { data: document, error: documentError } = await admin
    .from("documents")
    .select(
      "id, organisation_id, majeur_id, ged_dossier_id, type_document, storage_path, nom_original"
    )
    .eq("id", documentId)
    .single();

  if (documentError || !document) {
    throw new Error("Document introuvable.");
  }

  if (!document.majeur_id || !document.ged_dossier_id) {
    return {
      ignore: true,
      raisonIgnore: "Document non classé dans un dossier.",
      transactionsImportees: 0,
      transactionsIgnoreesDoublon: 0,
      lignesRejetees: 0,
      coherenceValidee: true,
      qualiteLisible: true,
      zonesIncertaines: [],
      necessiteVerification: false,
      ecartSolde: null,
      messageVerification: null,
    };
  }

  if (!isPdf(document.type_document)) {
    return {
      ignore: true,
      raisonIgnore: "Fichier non PDF.",
      transactionsImportees: 0,
      transactionsIgnoreesDoublon: 0,
      lignesRejetees: 0,
      coherenceValidee: true,
      qualiteLisible: true,
      zonesIncertaines: [],
      necessiteVerification: false,
      ecartSolde: null,
      messageVerification: null,
    };
  }

  const estReleve = await dossierImmediatEstReleve(
    admin,
    document.ged_dossier_id
  );

  if (!estReleve) {
    return {
      ignore: true,
      raisonIgnore: "Dossier non bancaire.",
      transactionsImportees: 0,
      transactionsIgnoreesDoublon: 0,
      lignesRejetees: 0,
      coherenceValidee: true,
      qualiteLisible: true,
      zonesIncertaines: [],
      necessiteVerification: false,
      ecartSolde: null,
      messageVerification: null,
    };
  }

  const { data: fichier, error: downloadError } = await admin.storage
    .from(BUCKET)
    .download(document.storage_path);

  if (downloadError || !fichier) {
    throw new Error(
      downloadError?.message ?? "Impossible de télécharger le PDF."
    );
  }

  const buffer = Buffer.from(await fichier.arrayBuffer());
  const pdfBase64 = buffer.toString("base64");

  return importerReleveBancaire({
    document: {
      id: document.id,
      organisation_id: document.organisation_id,
      majeur_id: document.majeur_id,
      ged_dossier_id: document.ged_dossier_id,
      type_document: document.type_document,
      storage_path: document.storage_path,
    },
    pdfBase64,
  });
}
