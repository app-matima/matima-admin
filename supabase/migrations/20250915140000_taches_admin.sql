-- Tâches libres de l'équipe admin (planning mobile)

CREATE TABLE IF NOT EXISTS public.taches_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users (id) ON DELETE CASCADE,
  titre text NOT NULL,
  date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS taches_admin_date_idx
  ON public.taches_admin (date);

CREATE INDEX IF NOT EXISTS taches_admin_admin_user_id_idx
  ON public.taches_admin (admin_user_id);

COMMENT ON TABLE public.taches_admin IS
  'Tâches libres de l''équipe Matima Admin (planning mobile)';

COMMENT ON COLUMN public.taches_admin.admin_user_id IS
  'Membre admin qui a créé / est assigné à la tâche';

COMMENT ON COLUMN public.taches_admin.date IS
  'Jour de la tâche (planning hebdomadaire)';
