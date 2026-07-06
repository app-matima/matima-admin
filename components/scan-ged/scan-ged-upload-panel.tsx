"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { isImage, isPdf } from "@/lib/documents/document-utils";
import {
  fetchScanGedContext,
  uploadScanGedDocuments,
  validerScanGedDocument,
  validerTousScanGedDocuments,
  type CategorieDocument,
  type DocumentNonClasse,
  type MajeurActif,
} from "@/lib/scan-ged/client";
import { cn } from "@/lib/utils";
import type { ScanGedOrganisation } from "@/types/scan-ged";

interface LigneDocument {
  documentId: string;
  storagePath: string;
  nom: string;
  categorieId: string;
  majeurId: string;
  typeDocument: string;
  propositionCategorieId?: string | null;
  propositionMajeurId?: string | null;
  propositionNom?: string | null;
}

interface ScanGedUploadPanelProps {
  organisation: ScanGedOrganisation;
  onChangeMjpm: () => void;
}

function documentVersLigne(document: DocumentNonClasse): LigneDocument {
  return {
    documentId: document.id,
    storagePath: document.storage_path,
    nom: document.nom_original,
    categorieId: document.proposition_categorie_id ?? "",
    majeurId: document.proposition_majeur_id ?? "",
    typeDocument: document.type_document,
    propositionCategorieId: document.proposition_categorie_id,
    propositionMajeurId: document.proposition_majeur_id,
    propositionNom: document.proposition_nom,
  };
}

function getNomMajeur(
  majeurs: MajeurActif[],
  majeurId?: string | null,
): string | null {
  if (!majeurId) {
    return null;
  }

  const majeur = majeurs.find((item) => item.id === majeurId);
  return majeur ? `${majeur.nom} ${majeur.prenom}` : null;
}

function getNomCategorie(
  categories: CategorieDocument[],
  categorieId?: string | null,
): string | null {
  if (!categorieId) {
    return null;
  }

  return (
    categories.find((categorie) => categorie.id === categorieId)?.nom ?? null
  );
}

function DocumentPreviewModal({
  ligne,
  onClose,
}: {
  ligne: LigneDocument | null;
  onClose: () => void;
}) {
  if (!ligne) {
    return null;
  }

  const previewUrl = `/api/storage/sign?path=${encodeURIComponent(ligne.storagePath)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F1923]/50"
        onClick={onClose}
        aria-label="Fermer la prévisualisation"
      />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h2 className="truncate text-sm font-medium text-text-strong">
            {ligne.nom}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text-strong"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto bg-page p-4">
          {isPdf(ligne.typeDocument) ? (
            <iframe
              src={previewUrl}
              title={ligne.nom}
              className="h-[min(70vh,720px)] w-full rounded-lg border border-border bg-white"
            />
          ) : isImage(ligne.typeDocument) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={ligne.nom}
              className="max-h-[min(70vh,720px)] max-w-full rounded-lg object-contain"
            />
          ) : (
            <p className="text-sm text-text-muted">
              Aperçu non disponible pour ce type de fichier.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScanGedUploadPanel({
  organisation,
  onChangeMjpm,
}: ScanGedUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<CategorieDocument[]>([]);
  const [majeurs, setMajeurs] = useState<MajeurActif[]>([]);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [chargement, setChargement] = useState(true);
  const [importEnCours, setImportEnCours] = useState(false);
  const [validationEnCours, setValidationEnCours] = useState(false);
  const [validationDocumentId, setValidationDocumentId] = useState<
    string | null
  >(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [glisserActif, setGlisserActif] = useState(false);
  const [previewLigne, setPreviewLigne] = useState<LigneDocument | null>(null);

  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const contexte = await fetchScanGedContext(organisation.organisationId);
      setCategories(contexte.categories);
      setMajeurs(contexte.majeurs);
      setLignes(contexte.documents.map(documentVersLigne));
    } catch (error) {
      setErreur(
        error instanceof Error
          ? error.message
          : "Impossible de charger les documents.",
      );
    } finally {
      setChargement(false);
    }
  }, [organisation.organisationId]);

  useEffect(() => {
    void chargerDonnees();
  }, [chargerDonnees]);

  function mettreAJourLigne(
    documentId: string,
    changements: Partial<LigneDocument>,
  ) {
    setLignes((courantes) =>
      courantes.map((ligne) =>
        ligne.documentId === documentId ? { ...ligne, ...changements } : ligne,
      ),
    );
  }

  async function traiterFichiers(fichiers: FileList | File[]) {
    const liste = Array.from(fichiers).filter((fichier) => {
      const type = fichier.type;
      const nom = fichier.name.toLowerCase();
      return (
        type.startsWith("image/") ||
        type === "application/pdf" ||
        nom.endsWith(".pdf")
      );
    });

    if (liste.length === 0) {
      setErreur("Seuls les fichiers PDF et images sont acceptés.");
      return;
    }

    setImportEnCours(true);
    setErreur(null);
    setMessage(null);

    try {
      const resultat = await uploadScanGedDocuments(
        organisation.organisationId,
        liste,
      );

      setLignes((courantes) => [
        ...resultat.documents.map(documentVersLigne),
        ...courantes,
      ]);

      const count = resultat.documents.length;
      setMessage(
        `${count} document${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}.`,
      );

      if (resultat.erreurs?.length) {
        setErreur(resultat.erreurs.join(" "));
      }
    } catch (error) {
      setErreur(
        error instanceof Error
          ? error.message
          : "Impossible d'importer les fichiers.",
      );
    } finally {
      setImportEnCours(false);
    }
  }

  async function handleValiderLigne(ligne: LigneDocument) {
    if (!ligne.categorieId || !ligne.majeurId || !ligne.nom.trim()) {
      setErreur("Veuillez renseigner le nom, la catégorie et le protégé.");
      return;
    }

    setValidationDocumentId(ligne.documentId);
    setErreur(null);
    setMessage(null);

    try {
      await validerScanGedDocument({
        documentId: ligne.documentId,
        categorieId: ligne.categorieId,
        majeurId: ligne.majeurId,
        nom: ligne.nom,
      });

      setLignes((courantes) =>
        courantes.filter((item) => item.documentId !== ligne.documentId),
      );
      setMessage("Document classé.");
    } catch (error) {
      setErreur(
        error instanceof Error
          ? error.message
          : "Impossible de valider le document.",
      );
    } finally {
      setValidationDocumentId(null);
    }
  }

  async function handleValiderTout() {
    const aValider = lignes.filter(
      (ligne) => ligne.categorieId && ligne.majeurId && ligne.nom.trim(),
    );

    if (aValider.length === 0) {
      setErreur(
        "Aucun document prêt : chaque ligne doit avoir un nom, une catégorie et un protégé.",
      );
      return;
    }

    setValidationEnCours(true);
    setErreur(null);
    setMessage(null);

    try {
      const resultat = await validerTousScanGedDocuments(
        aValider.map((ligne) => ({
          documentId: ligne.documentId,
          categorieId: ligne.categorieId,
          majeurId: ligne.majeurId,
          nom: ligne.nom,
        })),
      );

      const idsValides = new Set(aValider.map((ligne) => ligne.documentId));
      setLignes((courantes) =>
        courantes.filter((ligne) => !idsValides.has(ligne.documentId)),
      );
      setMessage(`${resultat.succes} document(s) classé(s).`);

      if (resultat.erreurs?.length) {
        setErreur(resultat.erreurs.join(" | "));
        await chargerDonnees();
      }
    } catch (error) {
      setErreur(
        error instanceof Error ? error.message : "Impossible de tout valider.",
      );
      await chargerDonnees();
    } finally {
      setValidationEnCours(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Cabinet sélectionné
          </p>
          <p className="text-base font-medium text-text-strong">
            {organisation.cabinetNom}
          </p>
        </div>
        <button
          type="button"
          onClick={onChangeMjpm}
          className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-strong transition-colors hover:bg-page sm:w-auto"
        >
          Changer de MJPM
        </button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setGlisserActif(true);
        }}
        onDragLeave={() => setGlisserActif(false)}
        onDrop={(event) => {
          event.preventDefault();
          setGlisserActif(false);
          if (event.dataTransfer.files.length > 0) {
            void traiterFichiers(event.dataTransfer.files);
          }
        }}
        className={cn(
          "rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-10",
          glisserActif
            ? "border-accent bg-[#E6F7F5]/40"
            : "border-border bg-card",
        )}
      >
        <div className="flex flex-col items-center gap-3">
          {importEnCours ? (
            <Loader2 className="h-7 w-7 animate-spin text-accent" />
          ) : (
            <FileUp className="h-7 w-7 text-[#9CA3AF]" />
          )}
          <div>
            <p className="text-sm font-medium text-text-strong">
              Glissez-déposez vos PDF et images ici
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Les PDF seront découpés automatiquement aux pages blanches
            </p>
          </div>
          <button
            type="button"
            disabled={importEnCours}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sélectionner des fichiers
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) {
                void traiterFichiers(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </div>
      </div>

      {erreur && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
          <p className="text-sm text-[#991B1B]">{erreur}</p>
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-[#B2DFDB] bg-[#E6F7F5] p-4">
          <p className="text-sm text-[#00796B]">{message}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">
          {chargement
            ? "Chargement…"
            : `${lignes.length} document${lignes.length > 1 ? "s" : ""} en attente`}
        </p>
        {lignes.length > 0 && (
          <button
            type="button"
            onClick={() => void handleValiderTout()}
            disabled={validationEnCours || importEnCours}
            className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {validationEnCours ? "Validation…" : "Tout valider"}
          </button>
        )}
      </div>

      {chargement ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
      ) : lignes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-10 text-center">
          <p className="text-sm text-text-muted">
            Aucun document en attente de classement.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lignes.map((ligne) => {
            const propositionCategorie = getNomCategorie(
              categories,
              ligne.propositionCategorieId,
            );
            const propositionMajeur = getNomMajeur(
              majeurs,
              ligne.propositionMajeurId,
            );
            const propositionTexte = [propositionCategorie, propositionMajeur]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={ligne.documentId}
                className="rounded-xl border border-border bg-card p-4 sm:p-5"
              >
                <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <div>
                    <label
                      htmlFor={`nom-${ligne.documentId}`}
                      className="mb-1.5 block text-xs font-medium text-text-muted"
                    >
                      Nom du fichier
                    </label>
                    <input
                      id={`nom-${ligne.documentId}`}
                      value={ligne.nom}
                      onChange={(event) =>
                        mettreAJourLigne(ligne.documentId, {
                          nom: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`cat-${ligne.documentId}`}
                      className="mb-1.5 block text-xs font-medium text-text-muted"
                    >
                      Catégorie
                    </label>
                    <select
                      id={`cat-${ligne.documentId}`}
                      value={ligne.categorieId}
                      onChange={(event) =>
                        mettreAJourLigne(ligne.documentId, {
                          categorieId: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="">Sélectionner…</option>
                      {categories.map((categorie) => (
                        <option key={categorie.id} value={categorie.id}>
                          {categorie.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={`majeur-${ligne.documentId}`}
                      className="mb-1.5 block text-xs font-medium text-text-muted"
                    >
                      Protégé
                    </label>
                    <select
                      id={`majeur-${ligne.documentId}`}
                      value={ligne.majeurId}
                      onChange={(event) =>
                        mettreAJourLigne(ligne.documentId, {
                          majeurId: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="">Sélectionner…</option>
                      {majeurs.map((majeur) => (
                        <option key={majeur.id} value={majeur.id}>
                          {majeur.nom} {majeur.prenom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setPreviewLigne(ligne)}
                      className="rounded-lg border border-border p-2 text-text-strong transition-colors hover:bg-page"
                      aria-label="Prévisualiser"
                      title="Prévisualiser"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleValiderLigne(ligne)}
                      disabled={
                        validationDocumentId === ligne.documentId ||
                        validationEnCours
                      }
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {validationDocumentId === ligne.documentId
                        ? "Validation…"
                        : "Valider"}
                    </button>
                  </div>
                </div>

                {propositionTexte && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <Badge variant="info">IA : {propositionTexte}</Badge>
                    {ligne.propositionNom && ligne.propositionNom !== ligne.nom && (
                      <span className="text-xs text-text-muted">
                        Nom suggéré : {ligne.propositionNom}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DocumentPreviewModal
        ligne={previewLigne}
        onClose={() => setPreviewLigne(null)}
      />
    </div>
  );
}
