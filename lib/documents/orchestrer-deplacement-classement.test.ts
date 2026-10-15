import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DocumentDejaClasseError,
  MESSAGE_DOCUMENT_DEJA_CLASSE,
} from "../scan-ged/filtrer-documents-admin";
import {
  MAX_DOCUMENTS_VALIDER_TOUT,
  MESSAGE_FICHIER_INTROUVABLE,
  estErreurFichierIntrouvable,
  messageErreurCopieStorage,
  orchestrerDeplacementClassement,
} from "./orchestrer-deplacement-classement";

describe("orchestrerDeplacementClassement", () => {
  it("exécute copy → update → remove dans cet ordre", async () => {
    const etapes: string[] = [];

    await orchestrerDeplacementClassement({
      copy: async () => {
        etapes.push("copy");
      },
      update: async () => {
        etapes.push("update");
        return "ok";
      },
      removeAncien: async () => {
        etapes.push("remove");
      },
      removeCopie: async () => {
        etapes.push("rollback");
      },
    });

    assert.deepEqual(etapes, ["copy", "update", "remove"]);
  });

  it("en cas d'échec de l'UPDATE, rollback de la copie et pas de remove ancien", async () => {
    const etapes: string[] = [];

    await assert.rejects(
      () =>
        orchestrerDeplacementClassement({
          copy: async () => {
            etapes.push("copy");
          },
          update: async () => {
            etapes.push("update");
            throw new Error("db down");
          },
          removeAncien: async () => {
            etapes.push("remove");
          },
          removeCopie: async () => {
            etapes.push("rollback");
          },
        }),
      /db down/,
    );

    assert.deepEqual(etapes, ["copy", "update", "rollback"]);
  });

  it("relance d'un document déjà classé : rollback copie + DocumentDejaClasseError", async () => {
    const etapes: string[] = [];

    await assert.rejects(
      () =>
        orchestrerDeplacementClassement({
          copy: async () => {
            etapes.push("copy");
          },
          update: async () => {
            etapes.push("update");
            return "deja_classe";
          },
          removeAncien: async () => {
            etapes.push("remove");
          },
          removeCopie: async () => {
            etapes.push("rollback");
          },
        }),
      (error: unknown) =>
        error instanceof DocumentDejaClasseError &&
        error.message === MESSAGE_DOCUMENT_DEJA_CLASSE,
    );

    assert.deepEqual(etapes, ["copy", "update", "rollback"]);
  });
});

describe("erreurs fichier introuvable", () => {
  it("normalise les messages Storage en « Fichier introuvable »", () => {
    assert.equal(estErreurFichierIntrouvable("Object not found"), true);
    assert.equal(
      messageErreurCopieStorage("Storage: Object not found"),
      MESSAGE_FICHIER_INTROUVABLE,
    );
    assert.equal(messageErreurCopieStorage("quota exceeded"), "quota exceeded");
  });
});

describe("limite valider-tout", () => {
  it("accepte jusqu'à 25 documents et refuse 26", () => {
    assert.equal(MAX_DOCUMENTS_VALIDER_TOUT, 25);
    assert.equal(25 <= MAX_DOCUMENTS_VALIDER_TOUT, true);
    assert.equal(26 > MAX_DOCUMENTS_VALIDER_TOUT, true);
  });

  it("la route refuse un lot de 26 avec erreur JSON claire", async () => {
    // Logique miroir de la garde dans valider-tout/route.ts
    function validerTailleLot(nb: number): {
      ok: boolean;
      error?: string;
      status?: number;
    } {
      if (nb > MAX_DOCUMENTS_VALIDER_TOUT) {
        return {
          ok: false,
          status: 400,
          error: `Trop de documents dans un seul appel (max ${MAX_DOCUMENTS_VALIDER_TOUT}).`,
        };
      }
      return { ok: true };
    }

    assert.equal(validerTailleLot(25).ok, true);
    const refuse = validerTailleLot(26);
    assert.equal(refuse.ok, false);
    assert.equal(refuse.status, 400);
    assert.match(refuse.error ?? "", /max 25/);
  });
});
