import type { TypeTransaction } from "@/types";

export interface CategorieTransactionDefaut {
  nom: string;
  type: TypeTransaction;
}

export const CATEGORIES_TRANSACTIONS_DEFAUT: CategorieTransactionDefaut[] = [
  { nom: "Pension de retraite", type: "revenu" },
  { nom: "AAH", type: "revenu" },
  { nom: "APA", type: "revenu" },
  { nom: "ASH", type: "revenu" },
  { nom: "Rente", type: "revenu" },
  { nom: "Indemnités journalières", type: "revenu" },
  { nom: "Remboursement sécurité sociale", type: "revenu" },
  { nom: "Allocations familiales", type: "revenu" },
  { nom: "Revenus fonciers", type: "revenu" },
  { nom: "Intérêts bancaires", type: "revenu" },
  { nom: "Aide sociale", type: "revenu" },
  { nom: "Don familial", type: "revenu" },
  { nom: "Vente de biens", type: "revenu" },
  { nom: "Autres revenus", type: "revenu" },
  { nom: "Loyer / charges", type: "depense" },
  { nom: "Énergie", type: "depense" },
  { nom: "Téléphone / internet", type: "depense" },
  { nom: "Alimentation", type: "depense" },
  { nom: "Santé / pharmacie", type: "depense" },
  { nom: "Transport", type: "depense" },
  { nom: "Habillage", type: "depense" },
  { nom: "Loisirs / culture", type: "depense" },
  { nom: "Frais bancaires", type: "depense" },
  { nom: "Assurances", type: "depense" },
  { nom: "Impôts et taxes", type: "depense" },
  { nom: "Hébergement / EHPAD", type: "depense" },
  { nom: "Argent de vie", type: "depense" },
  { nom: "Autres dépenses", type: "depense" },
];
