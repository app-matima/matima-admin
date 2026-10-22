-- Scan GED : état « classement_en_cours » + horodatage + claim atomique.
-- Fichier de migration à appliquer manuellement (ne pas exécuter depuis l'agent).

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS classement_started_at timestamptz;

COMMENT ON COLUMN public.documents.classement_started_at IS
  'Début du traitement IA (statut classement_en_cours). NULL hors traitement.';

COMMENT ON COLUMN public.documents.statut_classement IS
  'Scan GED : en_attente_classement | classement_en_cours | classe | echec_classement';

-- Contrainte de valeurs (absente historiquement).
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_statut_classement_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_statut_classement_check
  CHECK (
    statut_classement IS NULL
    OR statut_classement = ANY (
      ARRAY[
        'en_attente_classement'::text,
        'classement_en_cours'::text,
        'classe'::text,
        'echec_classement'::text
      ]
    )
  );

CREATE INDEX IF NOT EXISTS documents_scan_ged_file_classement_idx
  ON public.documents (organisation_id, created_at)
  WHERE majeur_id IS NULL
    AND statut_classement = ANY (
      ARRAY['en_attente_classement'::text, 'classement_en_cours'::text]
    );

/**
 * Claim atomique d'un lot pour le classement IA Scan GED.
 * - SKIP LOCKED : deux workers ne prennent jamais le même document.
 * - Reprend les classement_en_cours expirés (> 10 minutes).
 * - Si p_document_ids fourni : claim ciblé (y compris echec_classement).
 */
CREATE OR REPLACE FUNCTION public.claim_documents_classement_scan_ged(
  p_organisation_id uuid,
  p_admin_user_id uuid,
  p_taille integer DEFAULT 5,
  p_document_ids uuid[] DEFAULT NULL
)
RETURNS SETOF public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite integer;
  v_expiration interval := interval '10 minutes';
  v_ids_cibles boolean;
BEGIN
  IF p_organisation_id IS NULL OR p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'organisation_id et admin_user_id requis';
  END IF;

  v_limite := LEAST(GREATEST(COALESCE(p_taille, 5), 1), 20);
  v_ids_cibles :=
    p_document_ids IS NOT NULL AND cardinality(p_document_ids) > 0;

  RETURN QUERY
  WITH candidats AS (
    SELECT d.id
    FROM public.documents d
    WHERE d.organisation_id = p_organisation_id
      AND d.majeur_id IS NULL
      AND (
        d.scan_admin_user_id = p_admin_user_id
        OR d.scan_admin_user_id IS NULL
      )
      AND (
        CASE
          WHEN v_ids_cibles THEN
            d.id = ANY (p_document_ids)
            AND d.statut_classement = ANY (
              ARRAY[
                'en_attente_classement'::text,
                'classement_en_cours'::text,
                'echec_classement'::text
              ]
            )
            AND (
              d.statut_classement IS DISTINCT FROM 'classement_en_cours'
              OR d.classement_started_at IS NULL
              OR d.classement_started_at < (now() - v_expiration)
            )
          ELSE
            (
              d.statut_classement = 'en_attente_classement'
              OR (
                d.statut_classement = 'classement_en_cours'
                AND (
                  d.classement_started_at IS NULL
                  OR d.classement_started_at < (now() - v_expiration)
                )
              )
            )
        END
      )
    ORDER BY d.created_at ASC NULLS LAST
    LIMIT v_limite
    FOR UPDATE OF d SKIP LOCKED
  ),
  mis_a_jour AS (
    UPDATE public.documents d
    SET
      statut_classement = 'classement_en_cours',
      classement_started_at = now(),
      erreur_classement = NULL
    FROM candidats c
    WHERE d.id = c.id
    RETURNING d.*
  )
  SELECT * FROM mis_a_jour;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_documents_classement_scan_ged(
  uuid,
  uuid,
  integer,
  uuid[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_documents_classement_scan_ged(
  uuid,
  uuid,
  integer,
  uuid[]
) TO service_role;
