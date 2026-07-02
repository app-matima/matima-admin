"use server";

import { getClientDetail } from "@/lib/clients/get-organisations";
import type { ClientDetail } from "@/types/clients";

export async function fetchClientDetail(
  organisationId: string,
): Promise<ClientDetail | null> {
  return getClientDetail(organisationId);
}
