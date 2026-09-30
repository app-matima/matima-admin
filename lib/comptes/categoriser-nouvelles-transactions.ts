import { proposerCategorieTransaction } from "@/lib/claude/proposer-categorie-transaction";
import {
  getCategoriesTransactionsServeur,
  trouverOuCreerCategorieTransaction,
} from "@/lib/comptes/categories-transactions-server";
import { libellesBrutsSontSimilaires } from "@/lib/comptes/libelle-transaction-similarite";
import { chargerToutesLesLignes } from "@/lib/supabase/charger-toutes-les-lignes";
import { createAdminClient } from "@/lib/supabase/server";
import type { TypeTransaction } from "@/types";

interface TransactionLibelleValide {
  libelle_brut: string;
  categorie_id: string;
}

type AdminClient = ReturnType<typeof createAdminClient>;
type CategoriesListe = Awaited<
  ReturnType<typeof getCategoriesTransactionsServeur>
>;

const DELAI_RETRY_PROPOSITION_MS = 500;

function trouverCategorieValideeParLibelle(
  libelleBrut: string,
  transactionsValidees: TransactionLibelleValide[]
): string | null {
  for (const transaction of transactionsValidees) {
    if (libellesBrutsSontSimilaires(libelleBrut, transaction.libelle_brut)) {
      return transaction.categorie_id;
    }
  }

  return null;
}

async function chargerTransactionsLibellesValides(
  admin: AdminClient,
  majeurId: string
): Promise<TransactionLibelleValide[]> {
  const data = await chargerToutesLesLignes<{
    libelle_brut: string | null;
    categorie_id: string | null;
  }>(() =>
    admin
      .from("transactions")
      .select("libelle_brut, categorie_id")
      .eq("majeur_id", majeurId)
      .eq("categorie_validee", true)
      .not("categorie_id", "is", null)
      .not("libelle_brut", "is", null)
  );

  return data.filter(
    (transaction): transaction is TransactionLibelleValide =>
      Boolean(transaction.libelle_brut && transaction.categorie_id)
  );
}

async function appliquerCategorieValidee(
  admin: AdminClient,
  transactionId: string,
  categorieId: string
): Promise<void> {
  const { error } = await admin
    .from("transactions")
    .update({
      categorie_id: categorieId,
      categorie_validee: true,
    })
    .eq("id", transactionId);

  if (error) {
    console.error("[categoriser] Échec de validation de catégorie");
  }
}

async function appliquerPropositionCategorie(
  admin: AdminClient,
  transactionId: string,
  proposition: Awaited<ReturnType<typeof proposerCategorieTransaction>>,
  type: TypeTransaction,
  categories: CategoriesListe
): Promise<CategoriesListe> {
  if (!proposition) {
    return categories;
  }

  let categorieId: string | null = null;
  let categoriesMisesAJour = categories;

  if (proposition.categorieId) {
    categorieId = proposition.categorieId;
  } else if (proposition.nouveauNomCategorie) {
    try {
      const nouvelleCategorie = await trouverOuCreerCategorieTransaction(
        proposition.nouveauNomCategorie,
        type
      );
      categorieId = nouvelleCategorie.id;

      if (
        !categoriesMisesAJour.some(
          (categorie) => categorie.id === nouvelleCategorie.id
        )
      ) {
        categoriesMisesAJour = [...categoriesMisesAJour, nouvelleCategorie].sort(
          (a, b) => a.nom.localeCompare(b.nom)
        );
      }
    } catch {
      console.error("[categoriser] Échec de création de catégorie");
      return categories;
    }
  }

  if (!categorieId) {
    return categories;
  }

  const { error: updateError } = await admin
    .from("transactions")
    .update({
      categorie_id: categorieId,
      categorie_validee: false,
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error("[categoriser] Échec de proposition de catégorie");
    return categories;
  }

  return categoriesMisesAJour;
}

/**
 * Pipeline de catégorisation (mémoire de libellé + proposition IA),
 * partagé par l'import de relevés PDF.
 */
export async function categoriserNouvelleTransaction(params: {
  admin: AdminClient;
  majeurId: string;
  transactionId: string;
  libelleBrut: string;
  type: TypeTransaction;
  categories: CategoriesListe;
  transactionsLibellesValides: TransactionLibelleValide[];
}): Promise<CategoriesListe> {
  const categorieValideeId = trouverCategorieValideeParLibelle(
    params.libelleBrut,
    params.transactionsLibellesValides
  );

  if (categorieValideeId) {
    await appliquerCategorieValidee(
      params.admin,
      params.transactionId,
      categorieValideeId
    );
    return params.categories;
  }

  let proposition = await proposerCategorieTransaction({
    libelleBrut: params.libelleBrut,
    type: params.type,
    categories: params.categories,
  });

  if (!proposition) {
    await new Promise((resolve) =>
      setTimeout(resolve, DELAI_RETRY_PROPOSITION_MS)
    );
    proposition = await proposerCategorieTransaction({
      libelleBrut: params.libelleBrut,
      type: params.type,
      categories: params.categories,
    });
  }

  return appliquerPropositionCategorie(
    params.admin,
    params.transactionId,
    proposition,
    params.type,
    params.categories
  );
}

export async function preparerContexteCategorisation(majeurId: string): Promise<{
  admin: AdminClient;
  categories: CategoriesListe;
  transactionsLibellesValides: TransactionLibelleValide[];
}> {
  const admin = createAdminClient();
  const categories = await getCategoriesTransactionsServeur();
  const transactionsLibellesValides = await chargerTransactionsLibellesValides(
    admin,
    majeurId
  );

  return { admin, categories, transactionsLibellesValides };
}
