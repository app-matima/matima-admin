import { createAdminClient } from "@/lib/supabase/server";
import type { ContactInterne } from "@/types/contacts";

export async function getContacts(): Promise<ContactInterne[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("contacts_internes")
    .select(
      "id, nom, prenom, entreprise, telephone, email, role, notes, created_at",
    )
    .order("nom", { ascending: true });

  if (error) {
    console.error("getContacts", error);
    return [];
  }

  return (data ?? []) as ContactInterne[];
}
