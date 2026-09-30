import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DocumentDejaClasseError,
  MESSAGE_DOCUMENT_DEJA_CLASSE,
  documentAppartientAAdmin,
  estErreurDocumentDejaClasse,
  filtreOrDocumentsAdmin,
  filtrerDocumentsPourAdmin,
} from "./filtrer-documents-admin";

describe("filtrer documents admin Scan GED", () => {
  const adminA = "admin-a";
  const adminB = "admin-b";

  const documents = [
    { id: "1", scan_admin_user_id: adminA },
    { id: "2", scan_admin_user_id: adminB },
    { id: "3", scan_admin_user_id: null },
    { id: "4", scan_admin_user_id: undefined },
  ];

  it("par défaut n'affiche que les docs de l'admin + legacy null", () => {
    const filtrés = filtrerDocumentsPourAdmin(documents, adminA, false);
    assert.deepEqual(
      filtrés.map((doc) => doc.id),
      ["1", "3", "4"],
    );
  });

  it("« Voir tous » affiche tous les documents", () => {
    const filtrés = filtrerDocumentsPourAdmin(documents, adminA, true);
    assert.equal(filtrés.length, 4);
  });

  it("documentAppartientAAdmin exclut les docs d'un autre admin", () => {
    assert.equal(documentAppartientAAdmin(adminA, adminA), true);
    assert.equal(documentAppartientAAdmin(null, adminA), true);
    assert.equal(documentAppartientAAdmin(adminB, adminA), false);
  });

  it("filtre Or PostgREST cible admin + null", () => {
    assert.equal(
      filtreOrDocumentsAdmin(adminA),
      `scan_admin_user_id.eq.${adminA},scan_admin_user_id.is.null`,
    );
  });

  it("détecte le conflit 409 double validation", () => {
    assert.equal(estErreurDocumentDejaClasse(MESSAGE_DOCUMENT_DEJA_CLASSE), true);
    assert.equal(estErreurDocumentDejaClasse("autre"), false);

    const erreur = new DocumentDejaClasseError();
    assert.equal(erreur.status, 409);
    assert.equal(erreur.message, MESSAGE_DOCUMENT_DEJA_CLASSE);
  });
});

describe("traiter-lot limité à l'admin connecté", () => {
  it("ne sélectionne que les docs admin + legacy pour le lot", () => {
    const adminId = "admin-lot";
    const file = [
      { id: "a", scan_admin_user_id: adminId, statut: "en_attente_classement" },
      {
        id: "b",
        scan_admin_user_id: "autre",
        statut: "en_attente_classement",
      },
      { id: "c", scan_admin_user_id: null, statut: "en_attente_classement" },
    ];

    const pourLot = file.filter((doc) =>
      documentAppartientAAdmin(doc.scan_admin_user_id, adminId),
    );

    assert.deepEqual(
      pourLot.map((doc) => doc.id),
      ["a", "c"],
    );
  });
});
