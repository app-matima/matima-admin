import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Ancien upload multipart (body FormData) — désactivé (limite Vercel 4,5 Mo).
 * Utiliser signed-upload + classifier.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Cet endpoint n'accepte plus de fichiers en body. Utilisez l'upload Storage signé puis /classifier.",
    },
    { status: 410 },
  );
}
