"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { InviteAdminModal } from "@/components/parametres/invite-admin-modal";
import {
  getAdminNomComplet,
  getAdminRoleBadgeVariant,
  getAdminRoleLabel,
} from "@/lib/admin/utils";
import type { AdminUser } from "@/types/admin";

const deleteButtonClassName =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-transparent px-3 py-1.5 text-xs font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50";

interface EquipeSectionProps {
  users: AdminUser[];
  isAdmin: boolean;
  currentUserId: string;
}

export function EquipeSection({
  users,
  isAdmin,
  currentUserId,
}: EquipeSectionProps) {
  const router = useRouter();
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(
    null,
  );
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleDelete(user: AdminUser) {
    const nomComplet = getAdminNomComplet(user);
    const confirme = window.confirm(
      `Supprimer ${nomComplet} de l'équipe ? Cette action est irréversible.`,
    );

    if (!confirme) {
      return;
    }

    setErreur(null);
    setSuppressionEnCours(user.id);

    const response = await fetch("/api/delete-admin-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !result.success) {
      setErreur(result.error ?? "Impossible de supprimer cet utilisateur.");
      setSuppressionEnCours(null);
      return;
    }

    setSuppressionEnCours(null);
    router.refresh();
  }

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
          {erreur && (
            <p className="border-b border-border px-4 py-3 text-sm text-[#DC2626]">
              {erreur}
            </p>
          )}

          <div className="divide-y divide-border lg:hidden">
            {users.map((user) => {
              const canDelete = isAdmin && user.id !== currentUserId;

              return (
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
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(user)}
                        disabled={suppressionEnCours === user.id}
                        className={deleteButtonClassName}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {suppressionEnCours === user.id
                          ? "Suppression…"
                          : "Supprimer"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
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
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const canDelete = isAdmin && user.id !== currentUserId;

                  return (
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
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(user)}
                            disabled={suppressionEnCours === user.id}
                            className={deleteButtonClassName}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {suppressionEnCours === user.id
                              ? "Suppression…"
                              : "Supprimer"}
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                  );
                })}
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
