import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MobileCleNotFound() {
  return (
    <div className="space-y-4">
      <Link
        href="/m/cles"
        className="inline-flex items-center gap-1.5 text-sm text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Clés
      </Link>
      <p className="text-sm text-text-muted">Clé introuvable.</p>
    </div>
  );
}
