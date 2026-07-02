"use client";

import {
  formatContactValeur,
  getContactNomComplet,
} from "@/lib/contacts/utils";
import type { ContactInterne } from "@/types/contacts";

interface ContactsListProps {
  contacts: ContactInterne[];
  onSelect: (contact: ContactInterne) => void;
}

export function ContactsList({ contacts, onSelect }: ContactsListProps) {
  return (
    <>
      <div className="divide-y divide-border rounded-xl border border-border bg-card lg:hidden">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            onClick={() => onSelect(contact)}
            className="w-full space-y-2 p-4 text-left transition-colors hover:bg-page"
          >
            <p className="text-sm font-medium text-text-strong">
              {getContactNomComplet(contact)}
            </p>
            {contact.entreprise && (
              <p className="text-sm text-text-muted">{contact.entreprise}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              {contact.telephone && <span>{contact.telephone}</span>}
              {contact.email && <span>{contact.email}</span>}
              {contact.role && <span>{contact.role}</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-page">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                Nom
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                Prénom
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                Entreprise
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                Téléphone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                Rôle
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                onClick={() => onSelect(contact)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-page"
              >
                <td className="px-4 py-3 text-sm font-medium text-text-strong whitespace-nowrap">
                  {formatContactValeur(contact.nom)}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                  {formatContactValeur(contact.prenom)}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">
                  {formatContactValeur(contact.entreprise)}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                  {formatContactValeur(contact.telephone)}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted">
                  {formatContactValeur(contact.email)}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
                  {formatContactValeur(contact.role)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
