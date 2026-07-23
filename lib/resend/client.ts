import { Resend } from "resend";

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Configuration email manquante (RESEND_API_KEY).");
  }

  return new Resend(apiKey);
}

export function getResendFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error("Configuration email manquante (RESEND_FROM_EMAIL).");
  }

  return fromEmail;
}
