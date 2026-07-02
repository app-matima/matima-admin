"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { InviteAdminModal } from "@/components/parametres/invite-admin-modal";
import {
  getAdminNomComplet,
  getAdminRoleBadgeVariant,
  getAdminRoleLabel,
} from "@/lib/admin/utils";
import type { AdminUser } from "@/types/admin";

interface EquipeSectionProps {
  users: AdminUser[];
  isAdmin: boolean;
}

export function EquipeSection({ users, isAdmin }: EquipeSectionProps) {
  const router = useRouter();
  const [modaleOuverte, setModaleOuverte] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-text-strong">Équipe</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setModaleOuverte(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Inviter
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
            <Users className="h-6 w-6 text-[#9CA3AF]" />
          </div>
          <p className="text-sm font-medium text-text-strong">
            Aucun membre dans l&apos;équipe
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border lg:hidden">
            {users.map((user) => (
              <div key={user.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-strong">
                      {getAdminNomComplet(user)}
                    </p>
                    <p className="text-sm text-text-muted">{user.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={getAdminRoleBadgeVariant(user.role)}>
                      {getAdminRoleLabel(user.role)}
                    </Badge>
                    <Badge variant={user.actif ? "success" : "neutral"}>
                      {user.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-page">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Rôle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border transition-colors hover:bg-page"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-text-strong whitespace-nowrap">
                      {getAdminNomComplet(user)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getAdminRoleBadgeVariant(user.role)}>
                        {getAdminRoleLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.actif ? "success" : "neutral"}>
                        {user.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <InviteAdminModal
        open={modaleOuverte}
        onClose={() => setModaleOuverte(false)}
        onSuccess={() => router.refresh()}
      />
    </section>
  );
}
