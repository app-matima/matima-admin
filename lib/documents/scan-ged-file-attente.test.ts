import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPIRATION_CLASSEMENT_EN_COURS_MS,
  STATUT_CLASSEMENT_CLASSE,
  STATUT_CLASSEMENT_ECHEC,
  STATUT_CLASSEMENT_EN_ATTENTE,
  STATUT_CLASSEMENT_EN_COURS,
  bouclerTraitementLotsClassement,
  calculerRestantApresLot,
  documentEligibleFileClassement,
  estClassementEnCoursExpire,
  patchStatutApresClassement,
  patchStatutApresExceptionInattendue,
  simulerClaimAtomiqueSansDoublon,
  traiterPaquetDocumentsIndependamment,
} from "./scan-ged-file-attente";

describe("scan-ged file d'attente", () => {
  it("un document en échec ne bloque pas les suivants du même paquet", async () => {
    const appels: string[] = [];

    const details = await traiterPaquetDocumentsIndependamment(
      [
        { id: "1", nom: "a.pdf" },
        { id: "2", nom: "b.pdf" },
        { id: "3", nom: "c.pdf" },
      ],
      async (document) => {
        appels.push(document.id);
        if (document.id === "2") {
          throw new Error("timeout Anthropic");
        }
      },
    );

    assert.deepEqual(appels, ["1", "2", "3"]);
    assert.equal(details.length, 3);
    assert.equal(details[0]!.statut, STATUT_CLASSEMENT_CLASSE);
    assert.equal(details[0]!.erreur, null);
    assert.equal(details[1]!.statut, STATUT_CLASSEMENT_ECHEC);
    assert.equal(details[1]!.erreur, "timeout Anthropic");
    assert.equal(details[2]!.statut, STATUT_CLASSEMENT_CLASSE);
    assert.equal(details[2]!.erreur, null);
  });

  it("le comptage restant est correct", () => {
    assert.equal(calculerRestantApresLot(12, 5), 7);
    assert.equal(calculerRestantApresLot(5, 5), 0);
    assert.equal(calculerRestantApresLot(3, 5), 0);
    assert.equal(calculerRestantApresLot(0, 0), 0);

    const restantAvant = 10;
    const details = [
      { statut: STATUT_CLASSEMENT_CLASSE },
      { statut: STATUT_CLASSEMENT_ECHEC },
      { statut: STATUT_CLASSEMENT_CLASSE },
    ];
    assert.equal(
      calculerRestantApresLot(restantAvant, details.length),
      7,
    );
  });

  it("le statut échec conserve le message d'erreur", () => {
    const patch = patchStatutApresClassement({
      succes: false,
      messageErreur: "Réponse API invalide",
    });

    assert.equal(patch.statut_classement, STATUT_CLASSEMENT_ECHEC);
    assert.equal(patch.erreur_classement, "Réponse API invalide");
    assert.equal(patch.classement_started_at, null);

    const succes = patchStatutApresClassement({ succes: true });
    assert.equal(succes.statut_classement, STATUT_CLASSEMENT_CLASSE);
    assert.equal(succes.erreur_classement, null);
    assert.equal(succes.classement_started_at, null);

    const sansMessage = patchStatutApresClassement({
      succes: false,
      messageErreur: "   ",
    });
    assert.equal(sansMessage.statut_classement, STATUT_CLASSEMENT_ECHEC);
    assert.equal(sansMessage.erreur_classement, "Erreur de classement inconnue.");

    assert.equal(STATUT_CLASSEMENT_EN_ATTENTE, "en_attente_classement");
    assert.equal(STATUT_CLASSEMENT_EN_COURS, "classement_en_cours");
  });

  it("exception IA inattendue → en_attente (pas laisser en_cours)", () => {
    const patch = patchStatutApresExceptionInattendue();
    assert.equal(patch.statut_classement, STATUT_CLASSEMENT_EN_ATTENTE);
    assert.equal(patch.erreur_classement, null);
    assert.equal(patch.classement_started_at, null);
  });

  it("reprise d'un en_cours expiré (> 10 min)", () => {
    const maintenant = Date.parse("2025-10-22T12:00:00.000Z");
    const expire = new Date(
      maintenant - EXPIRATION_CLASSEMENT_EN_COURS_MS - 1_000,
    ).toISOString();

    assert.equal(estClassementEnCoursExpire(expire, maintenant), true);
    assert.equal(
      documentEligibleFileClassement(
        {
          id: "1",
          statut_classement: STATUT_CLASSEMENT_EN_COURS,
          classement_started_at: expire,
        },
        { maintenantMs: maintenant },
      ),
      true,
    );
  });

  it("non-reprise d'un en_cours récent (< 10 min)", () => {
    const maintenant = Date.parse("2025-10-22T12:00:00.000Z");
    const recent = new Date(maintenant - 60_000).toISOString();

    assert.equal(estClassementEnCoursExpire(recent, maintenant), false);
    assert.equal(
      documentEligibleFileClassement(
        {
          id: "1",
          statut_classement: STATUT_CLASSEMENT_EN_COURS,
          classement_started_at: recent,
        },
        { maintenantMs: maintenant },
      ),
      false,
    );
  });

  it("claim sans doublon entre deux workers simultanés", () => {
    const file = [
      { id: "a", claimedBy: null },
      { id: "b", claimedBy: null },
      { id: "c", claimedBy: null },
      { id: "d", claimedBy: null },
    ];

    const claimA = simulerClaimAtomiqueSansDoublon({
      file,
      workerId: "onglet-1",
      taille: 2,
    });
    const claimB = simulerClaimAtomiqueSansDoublon({
      file,
      workerId: "onglet-2",
      taille: 2,
    });

    assert.deepEqual(claimA, ["a", "b"]);
    assert.deepEqual(claimB, ["c", "d"]);

    const tous = [...claimA, ...claimB];
    assert.equal(new Set(tous).size, tous.length);

    const claimVide = simulerClaimAtomiqueSansDoublon({
      file,
      workerId: "onglet-3",
      taille: 2,
    });
    assert.deepEqual(claimVide, []);
  });

  it("boucle avec Arrêter s'interrompt entre les lots", async () => {
    let lots = 0;
    let arreter = false;

    const resultat = await bouclerTraitementLotsClassement({
      totalInitial: 10,
      devraitArreter: () => arreter,
      traiterLot: async () => {
        lots += 1;
        if (lots === 1) {
          arreter = true;
        }
        return { traite: 3, restant: Math.max(0, 10 - lots * 3) };
      },
    });

    assert.equal(resultat.arrete, true);
    assert.equal(lots, 1);
    assert.equal(resultat.fait, 3);
  });

  it("en_attente est toujours éligible ; classe et échec non (sauf relance)", () => {
    assert.equal(
      documentEligibleFileClassement({
        id: "1",
        statut_classement: STATUT_CLASSEMENT_EN_ATTENTE,
      }),
      true,
    );
    assert.equal(
      documentEligibleFileClassement({
        id: "2",
        statut_classement: STATUT_CLASSEMENT_CLASSE,
      }),
      false,
    );
    assert.equal(
      documentEligibleFileClassement({
        id: "3",
        statut_classement: STATUT_CLASSEMENT_ECHEC,
      }),
      false,
    );
    assert.equal(
      documentEligibleFileClassement(
        {
          id: "3",
          statut_classement: STATUT_CLASSEMENT_ECHEC,
        },
        { inclureEchecs: true },
      ),
      true,
    );
  });
});
