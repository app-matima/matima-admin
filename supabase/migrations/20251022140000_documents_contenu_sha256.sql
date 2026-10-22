-- Empreinte SHA-256 des documents Scan GED (détection de doublons avant upload).
-- Fichier de migration à appliquer manuellement (ne pas exécuter depuis l'agent).

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS contenu_sha256 text;

COMMENT ON COLUMN public.documents.contenu_sha256 IS
  'SHA-256 hex (64 caractères minuscules) du fichier déposé via Scan GED. NULL si inconnu / hors Scan GED.';

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_contenu_sha256_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_contenu_sha256_check
  CHECK (
    contenu_sha256 IS NULL
    OR contenu_sha256 ~ '^[0-9a-f]{64}$'
  );

CREATE INDEX IF NOT EXISTS documents_organisation_contenu_sha256_idx
  ON public.documents (organisation_id, contenu_sha256)
  WHERE contenu_sha256 IS NOT NULL;
