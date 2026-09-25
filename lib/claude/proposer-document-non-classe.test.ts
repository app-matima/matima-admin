import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  choisirDossierPourProtege,
  proposerDocumentNonClasse,
  resoudreDossierId,
  type DossierPourProposition,
  type MajeurPourProposition,
} from "./proposer-document-non-classe";

const MAJEUR_A: MajeurPourProposition = {
  id: "majeur-a",
  nom: "Dupont",
  prenom: "Jean",
};

const MAJEUR_B: MajeurPourProposition = {
  id: "majeur-b",
  nom: "Martin",
  prenom: "Claire",
};

const DOSSIER_A: DossierPourProposition = {
  id: "dossier-a",
  nom: "Banque",
  majeur_id: "majeur-a",
  parent_id: null,
};

const DOSSIER_B: DossierPourProposition = {
  id: "dossier-b",
  nom: "Banque",
  majeur_id: "majeur-b",
  parent_id: null,
};

async function pdfMinimal(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  return doc.save();
}

function reponseAnthropic(texte: string, usage = { input_tokens: 10, output_tokens: 5 }) {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: texte }],
      usage: { ...usage, cache_read_input_tokens: 0 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("classification en deux temps", () => {
  const fetchOriginal = globalThis.fetch;
  let appels: { body: Record<string, unknown> }[];

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    appels = [];
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    mock.restoreAll();
  });

  it("protégé non trouvé → pas d'appel B", async () => {
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      appels.push({ body });
      return reponseAnthropic(
        JSON.stringify({
          nom_lu_dans_document: "Inconnu",
          majeur_id: null,
          confiance: "basse",
        }),
      );
    }) as typeof fetch;

    const chargerDossiers = mock.fn(async () => [DOSSIER_A, DOSSIER_B]);

    const result = await proposerDocumentNonClasse({
      nomOriginal: "scan.pdf",
      typeDocument: "application/pdf",
      majeurs: [MAJEUR_A, MAJEUR_B],
      chargerDossiers,
      pdfBytes: await pdfMinimal(),
    });

    assert.equal(result.majeurId, null);
    assert.equal(result.gedDossierId, null);
    assert.equal(appels.length, 1);
    assert.equal(chargerDossiers.mock.callCount(), 0);
  });

  it("protégé trouvé → l'appel B ne reçoit que les dossiers de ce protégé", async () => {
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      appels.push({ body });

      if (appels.length === 1) {
        return reponseAnthropic(
          JSON.stringify({
            nom_lu_dans_document: "Jean Dupont",
            majeur_id: "majeur-a",
            confiance: "haute",
          }),
        );
      }

      return reponseAnthropic(
        JSON.stringify({
          emetteur: "Crédit Agricole",
          type_document: "relevé de compte",
          famille: "BANQUE",
          dossier_id: "dossier-a",
          nouveau_chemin_dossier: null,
          nom_fichier: "2026-01 Crédit Agricole - Relevé.pdf",
          confiance: "haute",
        }),
      );
    }) as typeof fetch;

    const result = await proposerDocumentNonClasse({
      nomOriginal: "scan.pdf",
      typeDocument: "application/pdf",
      majeurs: [MAJEUR_A, MAJEUR_B],
      chargerDossiers: async (majeurId) => {
        assert.equal(majeurId, "majeur-a");
        return [DOSSIER_A];
      },
      pdfBytes: await pdfMinimal(),
    });

    assert.equal(appels.length, 2);
    assert.equal(result.majeurId, "majeur-a");
    assert.equal(result.gedDossierId, "dossier-a");

    const appelB = appels[1]!.body;
    const messages = appelB.messages as {
      content: { type: string; text?: string }[];
    }[];
    const texteUser = messages[0]!.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");

    assert.match(texteUser, /dossier-a/);
    assert.doesNotMatch(texteUser, /dossier-b/);
    assert.match(texteUser, /arborescence_du_protege/);
    assert.doesNotMatch(texteUser, /arborescences_par_protege/);

    const system = appelB.system as { text: string; cache_control?: { type: string } }[];
    assert.ok(Array.isArray(system));
    assert.equal(system[0]?.cache_control?.type, "ephemeral");
  });

  it("dossier_id d'un autre protégé renvoyé par l'IA → rejeté", async () => {
    const classement = await (async () => {
      globalThis.fetch = (async () =>
        reponseAnthropic(
          JSON.stringify({
            emetteur: "EDF",
            type_document: "facture",
            famille: "FACTURES ET ABONNEMENTS",
            dossier_id: "dossier-b",
            nouveau_chemin_dossier: null,
            nom_fichier: "facture.pdf",
            confiance: "haute",
          }),
        )) as typeof fetch;

      return choisirDossierPourProtege({
        nomOriginal: "facture.pdf",
        typeDocument: "application/pdf",
        majeur: MAJEUR_A,
        dossiers: [DOSSIER_A],
        pdfBytes: await pdfMinimal(),
      });
    })();

    assert.equal(classement.gedDossierId, null);

    assert.equal(
      resoudreDossierId("dossier-b", "majeur-a", [DOSSIER_A, DOSSIER_B]),
      null,
    );
    assert.equal(
      resoudreDossierId("dossier-a", "majeur-a", [DOSSIER_A, DOSSIER_B]),
      "dossier-a",
    );
  });
});
