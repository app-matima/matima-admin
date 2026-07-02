import { redirect } from "next/navigation";
import { ContactsPageContent } from "@/components/contacts/contacts-page-content";
import { getContacts } from "@/lib/contacts/get-contacts";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const contacts = await getContacts();

  return (
    <ContactsPageContent
      contacts={contacts}
      isAdmin={currentUser.role === "admin"}
    />
  );
}
