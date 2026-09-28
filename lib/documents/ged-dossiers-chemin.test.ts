import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerOuRecupererCheminDossier } from "./ged-dossiers-server";

interface DossierMemoire {
  id: string;
  organisation_id: string;
  majeur_id: string;
  parent_id: string | null;
  nom: string;
  cree_par_ia: boolean;
}

/**
 * Client Supabase minimal en mémoire pour tester creerOuRecupererCheminDossier.
 */
function creerClientGedMemoire(initiaux: DossierMemoire[]): {
  client: SupabaseClient;
  store: DossierMemoire[];
} {
  const store = [...initiaux];
  let compteur = 0;

  type Filtres = {
    organisation_id?: string;
    majeur_id?: string;
    parent_id?: string | null;
    parent_id_is_null?: boolean;
  };

  function appliquerFiltres(filtres: Filtres): DossierMemoire[] {
    return store.filter((dossier) => {
      if (
        filtres.organisation_id !== undefined &&
        dossier.organisation_id !== filtres.organisation_id
      ) {
        return false;
      }
      if (
        filtres.majeur_id !== undefined &&
        dossier.majeur_id !== filtres.majeur_id
      ) {
        return false;
      }
      if (filtres.parent_id_is_null) {
        return dossier.parent_id === null;
      }
      if (filtres.parent_id !== undefined) {
        return dossier.parent_id === filtres.parent_id;
      }
      return true;
    });
  }

  function creerSelectBuilder(filtres: Filtres = {}) {
    const builder = {
      eq(colonne: string, valeur: string) {
        if (colonne === "organisation_id") {
          filtres.organisation_id = valeur;
        } else if (colonne === "majeur_id") {
          filtres.majeur_id = valeur;
        } else if (colonne === "parent_id") {
          filtres.parent_id = valeur;
          filtres.parent_id_is_null = false;
        }
        return builder;
      },
      is(colonne: string, valeur: null) {
        if (colonne === "parent_id" && valeur === null) {
          filtres.parent_id_is_null = true;
          filtres.parent_id = undefined;
        }
        return builder;
      },
      order() {
        return {
          async range(debut: number, fin: number) {
            const lignes = appliquerFiltres(filtres)
              .map((dossier) => ({ id: dossier.id, nom: dossier.nom }))
              .sort((a, b) => a.id.localeCompare(b.id));
            return {
              data: lignes.slice(debut, fin + 1),
              error: null,
            };
          },
        };
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      if (table !== "ged_dossiers") {
        throw new Error(`Table inattendue: ${table}`);
      }

      return {
        select(_colonnes?: string) {
          return creerSelectBuilder();
        },
        insert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  compteur += 1;
                  const cree: DossierMemoire = {
                    id: `cree-${compteur}`,
                    organisation_id: String(payload.organisation_id),
                    majeur_id: String(payload.majeur_id),
                    parent_id: (payload.parent_id as string | null) ?? null,
                    nom: String(payload.nom),
                    cree_par_ia: Boolean(payload.cree_par_ia),
                  };
                  store.push(cree);
                  return { data: cree, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, store };
}

describe("creerOuRecupererCheminDossier", () => {
  it("réutilise Ehpad existant et ne crée que Factures dessous (pas de doublon)", async () => {
    const { client, store } = creerClientGedMemoire([
      {
        id: "ehpad-existant",
        organisation_id: "org-1",
        majeur_id: "majeur-1",
        parent_id: null,
        nom: "Ehpad",
        cree_par_ia: false,
      },
    ]);

    // Simule la réponse IA : nouveau_chemin_dossier ["Ehpad", "Factures"]
    const idFinal = await creerOuRecupererCheminDossier(client, {
      organisationId: "org-1",
      majeurId: "majeur-1",
      segments: ["Ehpad", "Factures"],
      creeParIa: true,
    });

    const ehpad = store.filter(
      (dossier) =>
        dossier.majeur_id === "majeur-1" &&
        dossier.parent_id === null &&
        dossier.nom.toLowerCase() === "ehpad",
    );
    assert.equal(ehpad.length, 1, "ne doit pas créer de doublon Ehpad à la racine");
    assert.equal(ehpad[0]!.id, "ehpad-existant");

    const factures = store.filter(
      (dossier) =>
        dossier.parent_id === "ehpad-existant" &&
        dossier.nom.toLowerCase() === "factures",
    );
    assert.equal(factures.length, 1, "doit créer un seul sous-dossier Factures");
    assert.equal(idFinal, factures[0]!.id);
    assert.equal(factures[0]!.cree_par_ia, true);

    assert.equal(store.length, 2, "uniquement Ehpad + Factures");
  });
});
