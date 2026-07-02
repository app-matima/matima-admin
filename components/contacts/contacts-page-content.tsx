"use client";

import { useState } from "react";
import { ContactRound, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ContactDetailModal } from "@/components/contacts/contact-detail-modal";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { ContactsList } from "@/components/contacts/contacts-list";
import type { ContactInterne } from "@/types/contacts";

interface ContactsPageContentProps {
  contacts: ContactInterne[];
  isAdmin: boolean;
}

export function ContactsPageContent({
  contacts,
  isAdmin,
}: ContactsPageContentProps) {
  const router = useRouter();
  const [selectedContact, setSelectedContact] = useState<ContactInterne | null>(
    null,
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactInterne | null>(
    null,
  );

  function handleRefresh() {
    router.refresh();
  }

  function handleEdit(contact: ContactInterne) {
    setSelectedContact(null);
    setEditingContact(contact);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight text-text-strong">
          Contacts
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Ajouter un contact
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <ContactRound className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              Aucun contact
            </p>
            <p className="text-xs text-[#9CA3AF]">
              {isAdmin
                ? "Ajoutez votre premier contact interne"
                : "Les contacts internes apparaîtront ici"}
            </p>
          </div>
        </div>
      ) : (
        <ContactsList contacts={contacts} onSelect={setSelectedContact} />
      )}

      <ContactFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleRefresh}
      />

      <ContactFormModal
        open={Boolean(editingContact)}
        contact={editingContact}
        onClose={() => setEditingContact(null)}
        onSuccess={handleRefresh}
      />

      <ContactDetailModal
        contact={selectedContact}
        isAdmin={isAdmin}
        onClose={() => setSelectedContact(null)}
        onEdit={handleEdit}
        onDeleted={handleRefresh}
      />
    </div>
  );
}
