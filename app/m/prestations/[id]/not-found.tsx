import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MobilePrestationNotFound() {
  return (
    <div className="space-y-4">
      <Link
        href="/m/prestations"
        className="inline-flex items-center gap-1.5 text-sm text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Prestations
      </Link>
      <p className="text-sm text-text-muted">Prestation introuvable.</p>
    </div>
  );
}
