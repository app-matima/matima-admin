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
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("resize", resizeCanvas);
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
      className="fixed inset-0 z-[60] flex flex-col bg-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-titre"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
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

      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-sm text-text-muted">
          Demandez au bénéficiaire de signer dans la zone ci-dessous.
        </p>

        <div className="min-h-[220px] flex-1 rounded-xl border-2 border-dashed border-border bg-white sm:min-h-[280px]">
          <canvas ref={canvasRef} className="h-full w-full touch-none rounded-xl" />
        </div>

        {erreur && <p className="text-sm text-[#DC2626]">{erreur}</p>}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border p-4 sm:flex-row sm:justify-end">
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
  );
}
