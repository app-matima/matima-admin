-- Admin Scan GED qui a uploadé le document (null = matima-app ou legacy).
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS scan_admin_user_id uuid REFERENCES public.admin_users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documents.scan_admin_user_id IS
  'Admin Matima qui a scanné le document via Scan GED (null si upload matima-app ou antérieur).';

CREATE INDEX IF NOT EXISTS documents_scan_ged_admin_attente_idx
  ON public.documents (organisation_id, scan_admin_user_id, created_at)
  WHERE majeur_id IS NULL;
