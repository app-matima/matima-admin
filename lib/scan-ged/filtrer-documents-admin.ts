export const MESSAGE_DOCUMENT_DEJA_CLASSE =
  "Ce document a déjà été classé par un autre utilisateur";

/**
 * Documents de l'admin connecté + legacy (scan_admin_user_id null), visibles par tous.
 */
export function documentAppartientAAdmin(
  scanAdminUserId: string | null | undefined,
  adminUserId: string,
): boolean {
  return scanAdminUserId == null || scanAdminUserId === adminUserId;
}

export function filtrerDocumentsPourAdmin<
  T extends { scan_admin_user_id?: string | null },
>(documents: T[], adminUserId: string, voirTous: boolean): T[] {
  if (voirTous) {
    return documents;
  }

  return documents.filter((document) =>
    documentAppartientAAdmin(document.scan_admin_user_id, adminUserId),
  );
}

/**
 * Filtre PostgREST : documents de l'admin OU sans propriétaire (legacy).
 */
export function filtreOrDocumentsAdmin(adminUserId: string): string {
  return `scan_admin_user_id.eq.${adminUserId},scan_admin_user_id.is.null`;
}

export function estErreurDocumentDejaClasse(message: string): boolean {
  return message.trim() === MESSAGE_DOCUMENT_DEJA_CLASSE;
}

export class DocumentDejaClasseError extends Error {
  readonly status = 409 as const;

  constructor(message: string = MESSAGE_DOCUMENT_DEJA_CLASSE) {
    super(message);
    this.name = "DocumentDejaClasseError";
  }
}
