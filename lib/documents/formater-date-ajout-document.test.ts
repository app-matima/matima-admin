import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formaterDateAjoutDocument } from "./formater-date-ajout-document";

describe("formaterDateAjoutDocument", () => {
  it("formate en fuseau Europe/Paris (hiver UTC+1)", () => {
    // 12:00 UTC → 13:00 à Paris (CET)
    assert.equal(
      formaterDateAjoutDocument("2024-01-15T12:00:00.000Z"),
      "Ajouté le 15/01/2024 à 13:00",
    );
  });

  it("formate en fuseau Europe/Paris (été UTC+2)", () => {
    // 12:00 UTC → 14:00 à Paris (CEST)
    assert.equal(
      formaterDateAjoutDocument("2024-07-15T12:00:00.000Z"),
      "Ajouté le 15/07/2024 à 14:00",
    );
  });

  it("minuit Europe/Paris", () => {
    // 23:00 UTC le 10 mars (hiver) → 00:00 le 11 mars à Paris
    assert.equal(
      formaterDateAjoutDocument("2024-03-10T23:00:00.000Z"),
      "Ajouté le 11/03/2024 à 00:00",
    );
  });

  it("changement d'heure — passage à l'heure d'été (mars 2024)", () => {
    // Avant le saut : 00:30 UTC = 01:30 Paris (encore CET)
    assert.equal(
      formaterDateAjoutDocument("2024-03-31T00:30:00.000Z"),
      "Ajouté le 31/03/2024 à 01:30",
    );
    // Après le saut (2h → 3h) : 01:30 UTC = 03:30 Paris (CEST)
    assert.equal(
      formaterDateAjoutDocument("2024-03-31T01:30:00.000Z"),
      "Ajouté le 31/03/2024 à 03:30",
    );
  });

  it("absence ou invalide → null", () => {
    assert.equal(formaterDateAjoutDocument(null), null);
    assert.equal(formaterDateAjoutDocument(undefined), null);
    assert.equal(formaterDateAjoutDocument(""), null);
    assert.equal(formaterDateAjoutDocument("   "), null);
    assert.equal(formaterDateAjoutDocument("pas-une-date"), null);
    assert.equal(formaterDateAjoutDocument("2024-13-40T99:99:99Z"), null);
  });
});
