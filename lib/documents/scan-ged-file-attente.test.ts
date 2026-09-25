import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STATUT_CLASSEMENT_CLASSE,
  STATUT_CLASSEMENT_ECHEC,
  STATUT_CLASSEMENT_EN_ATTENTE,
  calculerRestantApresLot,
  patchStatutApresClassement,
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

    // Échecs + succès quittent tous la file
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

    const succes = patchStatutApresClassement({ succes: true });
    assert.equal(succes.statut_classement, STATUT_CLASSEMENT_CLASSE);
    assert.equal(succes.erreur_classement, null);

    const sansMessage = patchStatutApresClassement({
      succes: false,
      messageErreur: "   ",
    });
    assert.equal(sansMessage.statut_classement, STATUT_CLASSEMENT_ECHEC);
    assert.equal(sansMessage.erreur_classement, "Erreur de classement inconnue.");

    assert.equal(STATUT_CLASSEMENT_EN_ATTENTE, "en_attente_classement");
  });
});
