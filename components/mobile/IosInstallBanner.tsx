"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const STORAGE_KEY = "matima-admin-ios-install-banner-dismissed";

function estIos(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) {
    return true;
  }

  // iPadOS desktop UA
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

function estModeStandalone(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const mediaStandalone = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return mediaStandalone || iosStandalone;
}

/**
 * Bandeau d'instructions d'installation iOS (Safari → Partager → Sur l'écran d'accueil).
 * Affiché uniquement sur iOS, hors mode standalone, et tant que non masqué.
 */
export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (estModeStandalone() || !estIos()) {
        return;
      }
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        return;
      }
      setVisible(true);
    } catch {
      if (estIos() && !estModeStandalone()) {
        setVisible(true);
      }
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="border-b border-white/10 bg-[#0F1923] px-4 py-3 text-white"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00A394]/20 text-[#00A394]">
          <Share className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium tracking-tight">
            Installer Matima Admin sur votre iPhone
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            Appuyez sur{" "}
            <span className="inline-flex items-center gap-0.5 font-medium text-white">
              Partager
              <Share className="inline h-3 w-3" aria-hidden />
            </span>{" "}
            puis choisissez{" "}
            <span className="font-medium text-white">
              Sur l&apos;écran d&apos;accueil
            </span>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
