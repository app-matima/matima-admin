export interface ContactInterne {
  id: string;
  nom: string;
  prenom: string | null;
  entreprise: string | null;
  telephone: string | null;
  email: string | null;
  role: string | null;
  notes: string | null;
  created_at?: string;
}

export interface ContactFormInput {
  nom: string;
  prenom: string;
  entreprise: string;
  telephone: string;
  email: string;
  role: string;
  notes: string;
}
