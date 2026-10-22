import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_HASH_PAR_APPEL_VERIFICATION,
  decouperEnPaquets,
  detecterDoublonsInternesLot,
  estContenuSha256Valide,
  normaliserContenuSha256,
  selectionnerFichiersApresConfirmation,
} from "./scan-ged-empreintes";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

describe("scan-ged empreintes", () => {
  it("valide le format SHA-256 hex minuscule 64 car.", () => {
    assert.equal(estContenuSha256Valide(HASH_A), true);
    assert.equal(estContenuSha256Valide("A".repeat(64)), false);
    assert.equal(estContenuSha256Valide("abc"), false);
    assert.equal(estContenuSha256Valide(null), false);
    assert.equal(normaliserContenuSha256("A".repeat(64)), HASH_A);
    assert.equal(normaliserContenuSha256("invalide"), null);
  });

  it("découpe les lots > 500 hash", () => {
    const hashes = Array.from({ length: 501 }, (_, i) =>
      i.toString(16).padStart(64, "0"),
    );
    const paquets = decouperEnPaquets(hashes, MAX_HASH_PAR_APPEL_VERIFICATION);
    assert.equal(paquets.length, 2);
    assert.equal(paquets[0]!.length, 500);
    assert.equal(paquets[1]!.length, 1);
  });

  it("détecte les doublons internes et ne garde qu'un par hash", () => {
    const { indexesAGarder, doublonsInternes } = detecterDoublonsInternesLot([
      { index: 0, nom: "a.pdf", contenuSha256: HASH_A },
      { index: 1, nom: "b.pdf", contenuSha256: HASH_B },
      { index: 2, nom: "a-copie.pdf", contenuSha256: HASH_A },
      { index: 3, nom: "sans-hash.pdf", contenuSha256: null },
    ]);

    assert.deepEqual(indexesAGarder, [0, 1, 3]);
    assert.equal(doublonsInternes.length, 1);
    assert.equal(doublonsInternes[0]!.index, 2);
    assert.equal(doublonsInternes[0]!.indexConserve, 0);
  });

  it("sélectionne seulement les nouveaux (exclut connus + internes)", () => {
    const fichiers = [
      { index: 0, nom: "a.pdf", contenuSha256: HASH_A },
      { index: 1, nom: "b.pdf", contenuSha256: HASH_B },
      { index: 2, nom: "a2.pdf", contenuSha256: HASH_A },
      { index: 3, nom: "c.pdf", contenuSha256: HASH_C },
      { index: 4, nom: "x.pdf", contenuSha256: null },
    ];
    const connus = new Set([HASH_A]);

    assert.deepEqual(
      selectionnerFichiersApresConfirmation({
        choix: "nouveaux",
        fichiers,
        hashesConnus: connus,
      }),
      [1, 3, 4],
    );

    assert.deepEqual(
      selectionnerFichiersApresConfirmation({
        choix: "tous",
        fichiers,
        hashesConnus: connus,
      }),
      [0, 1, 3, 4],
    );

    assert.deepEqual(
      selectionnerFichiersApresConfirmation({
        choix: "annuler",
        fichiers,
        hashesConnus: connus,
      }),
      [],
    );
  });

  it("lot entièrement nouveau : pas de filtre (tous gardés)", () => {
    const fichiers = [
      { index: 0, nom: "a.pdf", contenuSha256: HASH_A },
      { index: 1, nom: "b.pdf", contenuSha256: HASH_B },
    ];
    assert.deepEqual(
      selectionnerFichiersApresConfirmation({
        choix: "nouveaux",
        fichiers,
        hashesConnus: new Set(),
      }),
      [0, 1],
    );
  });

  it("lot entièrement déjà envoyé : nouveaux → vide", () => {
    const fichiers = [
      { index: 0, nom: "a.pdf", contenuSha256: HASH_A },
      { index: 1, nom: "b.pdf", contenuSha256: HASH_B },
    ];
    assert.deepEqual(
      selectionnerFichiersApresConfirmation({
        choix: "nouveaux",
        fichiers,
        hashesConnus: new Set([HASH_A, HASH_B]),
      }),
      [],
    );
  });

  it("hash en échec (null) est toujours envoyé", () => {
    const fichiers = [
      { index: 0, nom: "gros.pdf", contenuSha256: null },
      { index: 1, nom: "connu.pdf", contenuSha256: HASH_A },
    ];
    assert.deepEqual(
      selectionnerFichiersApresConfirmation({
        choix: "nouveaux",
        fichiers,
        hashesConnus: new Set([HASH_A]),
      }),
      [0],
    );
  });
});

describe("scan-ged empreintes — isolation organisation (logique)", () => {
  it("ne mélange pas les hash de deux organisations", () => {
    // La route filtre toujours .eq('organisation_id', organisationId URL).
    // Ce test documente le contrat : un match d'une autre org n'est jamais
    // inclus dans le résultat filtré.
    const docs = [
      { organisation_id: "org-a", contenu_sha256: HASH_A },
      { organisation_id: "org-b", contenu_sha256: HASH_A },
    ];
    const orgCible = "org-a";
    const hashesDemandes = new Set([HASH_A]);
    const resultats = docs.filter(
      (doc) =>
        doc.organisation_id === orgCible &&
        hashesDemandes.has(doc.contenu_sha256),
    );
    assert.equal(resultats.length, 1);
    assert.equal(resultats[0]!.organisation_id, "org-a");
  });
});

describe("scan-ged empreintes — backfill reprenable", () => {
  it("simule reprise après interruption (reste > 0)", () => {
    let restant = 120;
    let fait = 0;
    const tailleLot = 50;

    while (restant > 0) {
      const traites = Math.min(tailleLot, restant);
      // interruption après 1 lot
      if (fait > 0) {
        break;
      }
      fait += traites;
      restant -= traites;
    }

    assert.equal(fait, 50);
    assert.equal(restant, 70);

    // reprise
    while (restant > 0) {
      const traites = Math.min(tailleLot, restant);
      fait += traites;
      restant -= traites;
    }

    assert.equal(fait, 120);
    assert.equal(restant, 0);
  });
});
