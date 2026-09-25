-- File d'attente de classement IA Scan GED (admin).
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS statut_classement text,
  ADD COLUMN IF NOT EXISTS erreur_classement text;

COMMENT ON COLUMN public.documents.statut_classement IS
  'Scan GED : en_attente_classement | classe | echec_classement';

COMMENT ON COLUMN public.documents.erreur_classement IS
  'Message d''erreur lorsque statut_classement = echec_classement';

-- Documents déjà en attente de validation admin : déjà passés par l'IA.
UPDATE public.documents
SET statut_classement = 'classe'
WHERE majeur_id IS NULL
  AND statut_classement IS NULL;

CREATE INDEX IF NOT EXISTS documents_scan_ged_attente_classement_idx
  ON public.documents (organisation_id, created_at)
  WHERE statut_classement = 'en_attente_classement';
