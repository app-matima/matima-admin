import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  declencherExtractionReleveApresClassement,
  doitDeclencherExtractionReleve,
} from "./declencher-extraction-releve-apres-classement";
import { estDossierBancaire } from "./est-dossier-bancaire";

describe("déclenchement extraction relevé après classement Scan GED", () => {
  it("un dossier « Relevé » déclenche l'extraction", async () => {
    assert.equal(estDossierBancaire("Relevés de compte"), true);
    assert.equal(
      doitDeclencherExtractionReleve({
        typeDocument: "application/pdf",
        nomDossier: "Relevés de compte",
      }),
      true,
    );

    const appels: string[] = [];
    const declenche = await declencherExtractionReleveApresClassement(
      {
        documentId: "doc-releve",
        typeDocument: "application/pdf",
        gedDossierId: "dossier-1",
      },
      {
        nomDossier: "Relevés de compte",
        importer: async (documentId) => {
          appels.push(documentId);
          return { ignore: false };
        },
      },
    );

    assert.equal(declenche, true);
    assert.deepEqual(appels, ["doc-releve"]);
  });

  it("un dossier hors relevé ne déclenche pas l'extraction", async () => {
    assert.equal(estDossierBancaire("Factures"), false);
    assert.equal(
      doitDeclencherExtractionReleve({
        typeDocument: "application/pdf",
        nomDossier: "Factures",
      }),
      false,
    );

    const appels: string[] = [];
    const declenche = await declencherExtractionReleveApresClassement(
      {
        documentId: "doc-facture",
        typeDocument: "application/pdf",
        gedDossierId: "dossier-2",
      },
      {
        nomDossier: "Factures",
        importer: async (documentId) => {
          appels.push(documentId);
        },
      },
    );

    assert.equal(declenche, false);
    assert.deepEqual(appels, []);
  });

  it("un non-PDF dans un dossier Relevé ne déclenche pas", async () => {
    const appels: string[] = [];
    const declenche = await declencherExtractionReleveApresClassement(
      {
        documentId: "doc-img",
        typeDocument: "image/jpeg",
        gedDossierId: "dossier-1",
      },
      {
        nomDossier: "Relevés",
        importer: async (documentId) => {
          appels.push(documentId);
        },
      },
    );

    assert.equal(declenche, false);
    assert.deepEqual(appels, []);
  });

  it("un échec d'extraction n'est pas propagé (document reste classé)", async () => {
    const declenche = await declencherExtractionReleveApresClassement(
      {
        documentId: "doc-err",
        typeDocument: "application/pdf",
        gedDossierId: "dossier-1",
      },
      {
        nomDossier: "Relevé bancaire",
        importer: async () => {
          throw new Error("Claude timeout");
        },
      },
    );

    assert.equal(declenche, true);
  });
});
