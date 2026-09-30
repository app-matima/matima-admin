import { CATEGORIES_TRANSACTIONS_DEFAUT } from "@/lib/comptes/categories-defaut";
import { createAdminClient } from "@/lib/supabase/server";
import type { CategorieTransaction, TypeTransaction } from "@/types";

function normaliserNomCategorie(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function insererCategoriesDefautServeur(): Promise<void> {
  const admin = createAdminClient();
  const lignes = CATEGORIES_TRANSACTIONS_DEFAUT.map((categorie) => ({
    nom: categorie.nom,
    type: categorie.type,
  }));

  const { error } = await admin
    .from("categories_transactions")
    .upsert(lignes, { onConflict: "nom,type", ignoreDuplicates: true });

  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureCategoriesTransactionsGlobales(): Promise<void> {
  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("categories_transactions")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) === 0) {
    await insererCategoriesDefautServeur();
  }
}

export async function getCategoriesTransactionsServeur(): Promise<
  CategorieTransaction[]
> {
  await ensureCategoriesTransactionsGlobales();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("categories_transactions")
    .select("*")
    .order("nom", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CategorieTransaction[];
}

export async function trouverOuCreerCategorieTransaction(
  nom: string,
  type: TypeTransaction
): Promise<CategorieTransaction> {
  const nomTrim = nom.trim();

  if (!nomTrim) {
    throw new Error("Le nom de la catégorie est obligatoire.");
  }

  const categories = await getCategoriesTransactionsServeur();
  const existante = categories.find(
    (categorie) =>
      categorie.type === type &&
      normaliserNomCategorie(categorie.nom) === normaliserNomCategorie(nomTrim)
  );

  if (existante) {
    return existante;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("categories_transactions")
    .insert({
      nom: nomTrim,
      type,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de créer la catégorie.");
  }

  return data as CategorieTransaction;
}
