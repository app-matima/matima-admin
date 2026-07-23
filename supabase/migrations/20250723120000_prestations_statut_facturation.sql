-- Suivi de facturation des prestations (Pennylane)

ALTER TABLE public.prestations_commandes
  ADD COLUMN IF NOT EXISTS statut_facturation text NOT NULL DEFAULT 'a_facturer',
  ADD COLUMN IF NOT EXISTS pennylane_invoice_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prestations_commandes_statut_facturation_check'
  ) THEN
    ALTER TABLE public.prestations_commandes
      ADD CONSTRAINT prestations_commandes_statut_facturation_check
      CHECK (
        statut_facturation IN (
          'a_facturer',
          'facture_envoyee',
          'payee',
          'partiellement_payee'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.prestations_commandes.statut_facturation IS
  'Statut de facturation : a_facturer | facture_envoyee | payee | partiellement_payee';

COMMENT ON COLUMN public.prestations_commandes.pennylane_invoice_id IS
  'Identifiant ou numéro de facture Pennylane associé à la prestation';
