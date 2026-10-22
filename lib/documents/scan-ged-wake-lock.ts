/**
 * Screen Wake Lock pendant les boucles de classement Scan GED.
 * Ignore proprement les navigateurs / contextes sans support.
 */

export type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (
    type: "release",
    listener: () => void,
  ) => void;
};

type NavigatorAvecWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export async function demanderWakeLockEcran(): Promise<WakeLockSentinelLike | null> {
  if (typeof navigator === "undefined") {
    return null;
  }

  const nav = navigator as NavigatorAvecWakeLock;
  if (!nav.wakeLock?.request) {
    return null;
  }

  try {
    return await nav.wakeLock.request("screen");
  } catch {
    return null;
  }
}

export async function relacherWakeLock(
  sentinel: WakeLockSentinelLike | null,
): Promise<void> {
  if (!sentinel) {
    return;
  }

  try {
    await sentinel.release();
  } catch {
    // ignore
  }
}

/**
 * Maintient le wake lock pendant `action`, le redemande au retour d'onglet
 * (visibilitychange), et le relâche à la fin.
 */
export async function avecWakeLockPendantBoucle<T>(
  action: (controle: {
    relancerSiBesoin: () => Promise<void>;
  }) => Promise<T>,
): Promise<T> {
  let sentinel: WakeLockSentinelLike | null = await demanderWakeLockEcran();

  const relancerSiBesoin = async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (sentinel) {
      return;
    }
    sentinel = await demanderWakeLockEcran();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void relancerSiBesoin();
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  try {
    return await action({ relancerSiBesoin });
  } finally {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    await relacherWakeLock(sentinel);
    sentinel = null;
  }
}
