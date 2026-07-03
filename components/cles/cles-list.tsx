"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ChevronDown,
  KeyRound,
  Search,
  StickyNote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { updateCleNotes, updateCleStatut } from "@/lib/cles/actions";
import {
  filtrerGroupesCles,
  filtrerGroupesParRecherche,
  filtresCle,
  formatProtegeCount,
  getNomProtege,
  getStatutCleBadgeVariant,
  getStatutCleLabel,
  statutsCle,
  type FiltreCle,
} from "@/lib/cles/utils";
import { getMjpmNomComplet } from "@/lib/clients/utils";
import { cn } from "@/lib/utils";
import type { CleProtege, OrganisationClesGroupe, StatutCle } from "@/types/cles";

interface ClesListProps {
  groupes: OrganisationClesGroupe[];
}

function CleProtegeRow({ protege }: { protege: CleProtege }) {
  const router = useRouter();
  const notesRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [statut, setStatut] = useState(protege.statut);
  const [notes, setNotes] = useState(protege.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setStatut(protege.statut);
    setNotes(protege.notes ?? "");
  }, [protege.statut, protege.notes, protege.cleId]);

  useEffect(() => {
    if (!notesOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        notesRef.current &&
        !notesRef.current.contains(event.target as Node)
      ) {
        setNotesOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notesOpen]);

  function handleStatutChange(nouveauStatut: StatutCle) {
    setStatut(nouveauStatut);
    setErreur(null);

    startTransition(async () => {
      const result = await updateCleStatut(protege.cleId, nouveauStatut);
      if (!result.success) {
        setStatut(protege.statut);
        setErreur(result.error ?? "Erreur lors de la mise à jour.");
        return;
      }
      router.refresh();
    });
  }

  function handleNotesSave() {
    const valeurInitiale = protege.notes ?? "";
    if (notes === valeurInitiale) {
      return;
    }

    setErreur(null);

    startTransition(async () => {
      const result = await updateCleNotes(protege.cleId, notes);
      if (!result.success) {
        setNotes(valeurInitiale);
        setErreur(result.error ?? "Erreur lors de la sauvegarde.");
        return;
      }
      router.refresh();
    });
  }

  const hasNotes = Boolean(protege.notes?.trim());

  return (
    <div
      className={cn(
        "relative border-b border-border last:border-b-0 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <p className="min-w-0 flex-1 truncate text-sm text-text-strong">
          {getNomProtege(protege)}
        </p>

        <label className="sr-only" htmlFor={`statut-${protege.cleId}`}>
          Statut des clés pour {getNomProtege(protege)}
        </label>
        <select
          id={`statut-${protege.cleId}`}
          value={statut}
          onChange={(event) =>
            handleStatutChange(event.target.value as StatutCle)
          }
          disabled={isPending}
          className="w-[7.5rem] shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs text-text-strong transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed sm:w-36 sm:text-sm"
        >
          {statutsCle.map((option) => (
            <option key={option} value={option}>
              {getStatutCleLabel(option)}
            </option>
          ))}
        </select>

        <Badge
          variant={getStatutCleBadgeVariant(statut)}
          className="hidden shrink-0 sm:inline-flex"
        >
          {getStatutCleLabel(statut)}
        </Badge>

        <div className="relative shrink-0" ref={notesRef}>
          <button
            type="button"
            onClick={() => setNotesOpen((open) => !open)}
            disabled={isPending}
            title={
              hasNotes
                ? protege.notes ?? undefined
                : "Ajouter une note"
            }
            aria-label={
              hasNotes
                ? `Notes : ${protege.notes}`
                : "Ajouter une note"
            }
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed",
              hasNotes
                ? "text-accent hover:bg-[#E6F7F5]"
                : "text-text-muted hover:bg-page hover:text-text-strong",
            )}
          >
            <StickyNote className="h-4 w-4" />
          </button>

          {notesOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card p-2 shadow-lg sm:w-64">
              <label
                htmlFor={`notes-${protege.cleId}`}
                className="mb-1 block text-xs font-medium text-text-muted"
              >
                Notes
              </label>
              <textarea
                id={`notes-${protege.cleId}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={handleNotesSave}
                disabled={isPending}
                rows={3}
                placeholder="Ajouter une note…"
                className="w-full resize-none rounded-md border border-border bg-page px-2 py-1.5 text-xs text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          )}
        </div>
      </div>

      {erreur && (
        <p className="px-3 pb-2 text-xs text-[#991B1B] sm:px-4" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}

function MjpmAccordion({
  groupe,
  isOpen,
  onToggle,
}: {
  groupe: OrganisationClesGroupe;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const mjpmNom = getMjpmNomComplet(groupe.mjpm);
  const count = groupe.proteges.length;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-page sm:px-5"
      >
        <span className="min-w-0 text-sm font-medium text-text-strong sm:text-base">
          {mjpmNom}{" "}
          <span className="font-normal text-text-muted">
            ({formatProtegeCount(count)})
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-text-muted transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border bg-card">
          {groupe.proteges.map((protege) => (
            <CleProtegeRow key={protege.cleId} protege={protege} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ClesList({ groupes }: ClesListProps) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreCle>("tous");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const groupesFiltres = useMemo(() => {
    const parStatut = filtrerGroupesCles(groupes, filtre);
    return filtrerGroupesParRecherche(parStatut, recherche);
  }, [groupes, filtre, recherche]);

  function toggleGroupe(organisationId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(organisationId)) {
        next.delete(organisationId);
      } else {
        next.add(organisationId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="search"
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder="Rechercher un MJPM ou un protégé…"
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-text-strong transition-colors placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Rechercher un MJPM ou un protégé"
        />
      </div>

      <select
        value={filtre}
        onChange={(event) => setFiltre(event.target.value as FiltreCle)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-strong transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:hidden"
        aria-label="Filtrer par statut"
      >
        {filtresCle.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="hidden gap-2 md:flex md:flex-wrap">
        {filtresCle.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFiltre(option.id)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              filtre === option.id
                ? "bg-accent text-white"
                : "border border-border bg-card text-text-muted hover:bg-page hover:text-text-strong",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {groupesFiltres.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-page">
              <KeyRound className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-strong">
              Aucun résultat
            </p>
            <p className="text-xs text-[#9CA3AF]">
              Essayez une autre recherche ou un autre filtre
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groupesFiltres.map((groupe) => (
            <MjpmAccordion
              key={groupe.organisationId}
              groupe={groupe}
              isOpen={openIds.has(groupe.organisationId)}
              onToggle={() => toggleGroupe(groupe.organisationId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
