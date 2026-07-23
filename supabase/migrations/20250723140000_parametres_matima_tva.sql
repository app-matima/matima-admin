-- Réglages internes Matima (singleton) — estimation TVA admin

CREATE TABLE IF NOT EXISTS public.parametres_matima (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tva_montant_deja_provisionne numeric(12, 2) NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.parametres_matima IS
  'Réglages internes globaux Matima (une seule ligne)';

COMMENT ON COLUMN public.parametres_matima.tva_montant_deja_provisionne IS
  'Montant TVA déjà mis de côté (estimation interne Matima admin)';

INSERT INTO public.parametres_matima (id, tva_montant_deja_provisionne)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Nettoyage si l'ancienne colonne organisations avait été ajoutée
ALTER TABLE public.organisations
  DROP COLUMN IF EXISTS tva_montant_deja_provisionne;
