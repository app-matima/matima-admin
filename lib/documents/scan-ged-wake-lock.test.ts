import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  demanderWakeLockEcran,
  relacherWakeLock,
  avecWakeLockPendantBoucle,
} from "./scan-ged-wake-lock";

describe("scan-ged wake lock", () => {
  it("demande sans support navigateur renvoie null", async () => {
    const sentinel = await demanderWakeLockEcran();
    assert.equal(sentinel, null);
  });

  it("relâche null sans erreur", async () => {
    await relacherWakeLock(null);
  });

  it("avecWakeLockPendantBoucle exécute l'action même sans support", async () => {
    const valeur = await avecWakeLockPendantBoucle(async () => 42);
    assert.equal(valeur, 42);
  });
});
