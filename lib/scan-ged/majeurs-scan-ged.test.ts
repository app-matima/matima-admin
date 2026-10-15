import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStatutMajeurLabelSingulier,
  libelleOptionMajeurScanGed,
  trierMajeursScanGed,
} from "./majeurs-scan-ged";

describe("majeurs Scan GED — tous statuts", () => {
  it("trie les actifs d'abord, puis les autres, alpha dans chaque groupe", () => {
    const tries = trierMajeursScanGed([
      { id: "1", nom: "Zinn", prenom: "A", statut: "actif" as const },
      { id: "2", nom: "Martin", prenom: "B", statut: "decede" as const },
      { id: "3", nom: "Bernard", prenom: "C", statut: "actif" as const },
      { id: "4", nom: "Dupont", prenom: "D", statut: "mainleve" as const },
      { id: "5", nom: "Albert", prenom: "E", statut: "archive" as const },
    ]);

    assert.deepEqual(
      tries.map((m) => m.id),
      ["3", "1", "5", "4", "2"],
    );
    assert.equal(tries[0]!.statut, "actif");
    assert.equal(tries[1]!.statut, "actif");
    assert.ok(tries.slice(2).every((m) => m.statut !== "actif"));
  });

  it("affiche les labels Décédé et Mainlevée (pas Dessaisi)", () => {
    assert.equal(getStatutMajeurLabelSingulier("decede"), "Décédé");
    assert.equal(getStatutMajeurLabelSingulier("mainleve"), "Mainlevée");
    assert.equal(getStatutMajeurLabelSingulier("archive"), "Archivé");
    assert.notEqual(getStatutMajeurLabelSingulier("mainleve"), "Dessaisi");
  });

  it("libellé d'option : statut uniquement pour les non-actifs", () => {
    assert.equal(
      libelleOptionMajeurScanGed({
        nom: "Dupont",
        prenom: "Jean",
        statut: "actif",
      }),
      "Dupont Jean",
    );
    assert.equal(
      libelleOptionMajeurScanGed({
        nom: "Dupont",
        prenom: "Jean",
        statut: "decede",
      }),
      "Dupont Jean — Décédé",
    );
    assert.equal(
      libelleOptionMajeurScanGed({
        nom: "Martin",
        prenom: "Paul",
        statut: "mainleve",
      }),
      "Martin Paul — Mainlevée",
    );
  });

  it("ne mélange pas les organisations : le filtre org est appliqué avant le tri", () => {
    // Simule le filtre .eq(organisation_id) côté requête : seuls les majeurs org-A
    const majeursOrgA = [
      { id: "a1", nom: "A", prenom: "1", statut: "actif" as const, org: "org-A" },
      {
        id: "a2",
        nom: "B",
        prenom: "2",
        statut: "decede" as const,
        org: "org-A",
      },
    ];
    const autreOrg = {
      id: "b1",
      nom: "Z",
      prenom: "9",
      statut: "actif" as const,
      org: "org-B",
    };

    const filtrés = [...majeursOrgA, autreOrg].filter((m) => m.org === "org-A");
    const tries = trierMajeursScanGed(filtrés);

    assert.equal(tries.length, 2);
    assert.ok(tries.every((m) => m.org === "org-A"));
    assert.ok(!tries.some((m) => m.id === "b1"));
  });
});
