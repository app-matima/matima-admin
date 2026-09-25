/** Limite soft de PostgREST / Supabase — au-delà, les lignes sont tronquées silencieusement. */
export const TAILLE_PAGE_SUPABASE = 1000;

/**
 * Requête filtrée (sans .order / .range finaux).
 * Chaque appel à construireRequete() doit créer une requête fraîche.
 */
type RequetePaginable = {
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
};

/**
 * Charge toutes les lignes d'une requête Supabase en paginant par 1 000.
 * Impose un tri stable sur `colonneTri` (défaut : `id`) pour éviter sauts / doublons.
 */
export async function chargerToutesLesLignes<T>(
  construireRequete: () => RequetePaginable,
  colonneTri: string = "id",
): Promise<T[]> {
  const resultats: T[] = [];
  let debut = 0;

  for (;;) {
    const fin = debut + TAILLE_PAGE_SUPABASE - 1;
    const { data, error } = await construireRequete()
      .order(colonneTri, { ascending: true })
      .range(debut, fin);

    if (error) {
      throw new Error(error.message);
    }

    const page = (data ?? []) as T[];
    resultats.push(...page);

    if (page.length < TAILLE_PAGE_SUPABASE) {
      break;
    }

    debut += TAILLE_PAGE_SUPABASE;
  }

  return resultats;
}
