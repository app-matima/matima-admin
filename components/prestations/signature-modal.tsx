"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import SignaturePad from "signature_pad";

interface SignatureModalProps {
  open: boolean;
  prestationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignatureModal({
  open,
  prestationId,
  onClose,
  onSuccess,
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!open || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, {
      backgroundColor: "#FFFFFF",
      penColor: "#0F1923",
    });
    padRef.current = pad;

    function resizeCanvas() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const context = canvas.getContext("2d");

      if (context) {
        context.scale(ratio, ratio);
      }

      pad.clear();
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const container = canvasContainerRef.current;
    const observer =
      container && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resizeCanvas();
          })
        : null;

    if (container && observer) {
      observer.observe(container);
    }

    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      observer?.disconnect();
      pad.off();
      padRef.current = null;
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setErreur(null);
      setEnCours(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function handleClear() {
    padRef.current?.clear();
    setErreur(null);
  }

  async function handleValidate() {
    const pad = padRef.current;

    if (!pad || pad.isEmpty()) {
      setErreur("Veuillez signer avant de valider.");
      return;
    }

    setErreur(null);
    setEnCours(true);

    const signature = pad.toDataURL("image/png");

    const response = await fetch(`/api/prestations/${prestationId}/attestation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      setErreur(result.error ?? "Impossible de générer l'attestation.");
      setEnCours(false);
      return;
    }

    onSuccess();
    onClose();
    setEnCours(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-titre"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={() => !enCours && onClose()}
        aria-label="Fermer la modale"
      />

      <div className="relative flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:max-h-[90vh] sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2
            id="signature-titre"
            className="text-lg font-medium text-text-strong"
          >
            Signature du bénéficiaire
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={enCours}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-text-muted">
            Demandez au bénéficiaire de signer dans la zone ci-dessous.
          </p>

          <div
            ref={canvasContainerRef}
            className="h-48 w-full shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border bg-white sm:h-56"
          >
            <canvas
              ref={canvasRef}
              className="h-full w-full touch-none rounded-xl"
            />
          </div>

          {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-card p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClear}
            disabled={enCours}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-text-strong transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Effacer
          </button>
          <button
            type="button"
            onClick={() => void handleValidate()}
            disabled={enCours}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {enCours ? "Génération…" : "Valider la signature"}
          </button>
        </div>
      </div>
    </div>
  );
}
