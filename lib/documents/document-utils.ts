export function formatTailleFichier(octets: number): string {
  if (octets < 1024) {
    return `${octets} o`;
  }

  if (octets < 1024 * 1024) {
    return `${(octets / 1024).toFixed(1)} Ko`;
  }

  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export function isPdf(typeDocument: string): boolean {
  return typeDocument === "application/pdf";
}

export function isImage(typeDocument: string): boolean {
  return typeDocument.startsWith("image/");
}

export function sanitizeNomFichier(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export function buildInboxStoragePath(
  organisationId: string,
  nomOriginal: string,
): string {
  const nomSecurise = sanitizeNomFichier(nomOriginal);
  return `${organisationId}/inbox/${Date.now()}_${nomSecurise}`;
}

export function buildStoragePath(
  organisationId: string,
  majeurId: string,
  nomOriginal: string,
): string {
  const nomSecurise = sanitizeNomFichier(nomOriginal);
  return `${organisationId}/${majeurId}/${Date.now()}_${nomSecurise}`;
}
