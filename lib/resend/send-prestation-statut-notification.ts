import { getResendClient, getResendFromEmail } from "@/lib/resend/client";
import { getStatutPrestationLabel } from "@/lib/prestations/utils";
import type { StatutPrestation } from "@/types";

interface PrestationStatutEmailDetails {
  to: string;
  majeurNom: string;
  description: string;
  ancienStatut: StatutPrestation;
  nouveauStatut: StatutPrestation;
}

export async function sendPrestationStatutNotificationEmail(
  details: PrestationStatutEmailDetails,
): Promise<void> {
  const resend = getResendClient();
  const fromEmail = getResendFromEmail();

  const ancienStatutLabel = getStatutPrestationLabel(details.ancienStatut);
  const nouveauStatutLabel = getStatutPrestationLabel(details.nouveauStatut);

  const lignes = [
    ["Protégé", details.majeurNom],
    ["Description", details.description],
    ["Ancien statut", ancienStatutLabel],
    ["Nouveau statut", nouveauStatutLabel],
  ];

  const texte = lignes.map(([label, value]) => `${label} : ${value}`).join("\n");

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0F1923; line-height: 1.5;">
      <h2 style="font-size: 18px; font-weight: 500; margin: 0 0 8px;">
        Mise à jour de votre prestation
      </h2>
      <p style="margin: 0 0 16px; font-size: 14px; color: #6B7280;">
        Le statut d'une prestation a été modifié par l'équipe Matima.
      </p>
      <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
        ${lignes
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding: 8px 12px 8px 0; vertical-align: top; color: #6B7280; font-size: 13px; white-space: nowrap;">
              ${label}
            </td>
            <td style="padding: 8px 0; font-size: 14px;">
              ${value}
            </td>
          </tr>`,
          )
          .join("")}
      </table>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: details.to,
    subject: `Prestation — ${nouveauStatutLabel} (${details.majeurNom})`,
    text: texte,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
