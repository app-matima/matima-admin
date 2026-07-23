import { getNomMajeur } from "@/lib/prestations/utils";
import { getMjpmPrincipalEmail } from "@/lib/resend/get-mjpm-principal-email";
import { sendPrestationStatutNotificationEmail } from "@/lib/resend/send-prestation-statut-notification";
import type { StatutPrestation } from "@/types";

interface NotifyPrestationStatutChangeParams {
  organisationId: string;
  description: string | null | undefined;
  ancienStatut: StatutPrestation;
  nouveauStatut: StatutPrestation;
  majeur:
    | { nom: string; prenom: string }
    | { nom: string; prenom: string }[]
    | null
    | undefined;
}

export async function notifyPrestationStatutChange(
  params: NotifyPrestationStatutChangeParams,
): Promise<void> {
  if (params.ancienStatut === params.nouveauStatut) {
    return;
  }

  const mjpmEmail = await getMjpmPrincipalEmail(params.organisationId);

  if (!mjpmEmail) {
    return;
  }

  await sendPrestationStatutNotificationEmail({
    to: mjpmEmail,
    majeurNom: getNomMajeur(params.majeur),
    description: params.description?.trim() || "Non renseignée",
    ancienStatut: params.ancienStatut,
    nouveauStatut: params.nouveauStatut,
  });
}
