import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { generateAttestationPdf } from "@/lib/prestations/generate-attestation-pdf";
import { getNomMajeur } from "@/lib/prestations/utils";
import { createAdminClient } from "@/lib/supabase/server";

interface AttestationBody {
  signature?: string;
}

function getMajeurFields(
  majeur:
    | { nom: string; prenom: string }
    | { nom: string; prenom: string }[]
    | null
    | undefined,
): { nom: string; prenom: string } {
  if (!majeur) {
    return { nom: "—", prenom: "" };
  }

  const data = Array.isArray(majeur) ? majeur[0] : majeur;
  return {
    nom: data?.nom ?? "—",
    prenom: data?.prenom ?? "",
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }

  let body: AttestationBody;

  try {
    body = (await request.json()) as AttestationBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const signature = body.signature?.trim();

  if (!signature || !signature.startsWith("data:image")) {
    return NextResponse.json(
      { error: "Signature invalide." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: prestation, error: fetchError } = await supabase
    .from("prestations_commandes")
    .select(
      "id, organisation_id, majeur_id, description, statut, prestataire_id, majeurs(nom, prenom)",
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("attestation fetch", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!prestation) {
    return NextResponse.json(
      { error: "Prestation introuvable." },
      { status: 404 },
    );
  }

  if (prestation.statut !== "en_cours") {
    return NextResponse.json(
      { error: "Seules les prestations en cours peuvent être réalisées." },
      { status: 400 },
    );
  }

  if (
    currentUser.role === "prestataire" &&
    prestation.prestataire_id !== currentUser.id
  ) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const now = new Date();
  const dateRealisation = now.toLocaleDateString("fr-FR");
  const heureRealisation = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const { nom, prenom } = getMajeurFields(prestation.majeurs);

  let pdfBuffer: ArrayBuffer;

  try {
    pdfBuffer = generateAttestationPdf({
      majeurNom: nom,
      majeurPrenom: prenom,
      description: prestation.description,
      dateRealisation,
      heureRealisation,
      signatureDataUrl: signature,
    });
  } catch (error) {
    console.error("attestation pdf", error);
    return NextResponse.json(
      { error: "Impossible de générer le PDF." },
      { status: 500 },
    );
  }

  const storagePath = `attestations/${id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, Buffer.from(pdfBuffer), {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("attestation upload", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from("documents")
    .getPublicUrl(storagePath);

  const attestationUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("prestations_commandes")
    .update({
      attestation_url: attestationUrl,
      statut: "realise",
    })
    .eq("id", id);

  if (updateError) {
    console.error("attestation update prestation", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: documentError } = await supabase.from("documents").insert({
    majeur_id: prestation.majeur_id,
    organisation_id: prestation.organisation_id,
    type_document: "autre",
    nom_fichier: `attestation_${id}_${Date.now()}.pdf`,
    nom_original: "Attestation de prestation.pdf",
    storage_path: storagePath,
  });

  if (documentError) {
    console.error("attestation insert document", documentError);
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }

  revalidatePath("/prestations");
  revalidatePath("/planning");
  revalidatePath("/dashboard");

  return NextResponse.json({
    success: true,
    attestation_url: attestationUrl,
    majeur: getNomMajeur(prestation.majeurs),
  });
}
