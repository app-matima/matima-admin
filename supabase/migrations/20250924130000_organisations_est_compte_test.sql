-- Marqueur compte de test : masqué des listes / compteurs admin, sans suppression.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS est_compte_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organisations.est_compte_test IS
  'Si true, l''organisation est exclue des listes et compteurs admin (compte de test).';

UPDATE public.organisations
SET est_compte_test = true
WHERE id IN (
  '4668b7d0-b981-4fb1-8bf1-bf46d9246105',
  '6bffe7db-22e2-4c0f-a801-3fc913ae9ce6',
  '5cc0b933-059c-43bd-86b8-6a00d6776705'
);
