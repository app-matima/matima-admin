"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { GedDossierSelect } from "@/components/scan-ged/ged-dossier-select";
import { isImage, isPdf } from "@/lib/documents/document-utils";
import {
  NOUVEAU_DOSSIER_MANUEL,
  NOUVEAU_DOSSIER_SELECTION,
} from "@/lib/documents/ged-dossier-constants";
import {
  analyserSegmentsNouveauChemin,
  formatCheminDossierBreadcrumb,
  formatSegmentsCheminBreadcrumb,
} from "@/lib/documents/ged-dossier-utils";
import {
  fetchScanGedContext,
  uploadScanGedDocuments,
  validerScanGedDocument,
  validerTousScanGedDocuments,
  type DocumentNonClasse,
  type GedDossier,
  type MajeurActif,
} from "@/lib/scan-ged/client";
import { cn } from "@/lib/utils";
import type { ScanGedOrganisation } from "@/types/scan-ged";

interface LigneDocument {
  documentId: string;
  storagePath: string;
  nom: string;
  gedDossierId: string;
  majeurId: string;
  typeDocument: string;
  propositionGedDossierId?: string | null;
  propositionNouveauCheminDossier?: string[] | null;
  propositionSuggestionDossierExistant?: { id: string; nom: string } | null;
  propositionMajeurId?: string | null;
  propositionNom?: string | null;
  nouveauCheminManuel?: string[];
}

interface ScanGedUploadPanelProps {
  organisation: ScanGedOrganisation;
  onChangeMjpm: () => void;
}

function normaliserCheminProposition(valeur: unknown): string[] | null {
  if (!Array.isArray(valeur)) {
    return null;
  }

  const segments = valeur
    .filter((segment): segment is string => typeof segment === "string")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length > 0 ? segments : null;
}

function normaliserSuggestionDossierExistant(
  valeur: unknown,
): { id: string; nom: string } | null {
  if (!valeur || typeof valeur !== "object") {
    return null;
  }

  const candidat = valeur as { id?: unknown; nom?: unknown };
  if (
    typeof candidat.id !== "string" ||
    !candidat.id.trim() ||
    typeof candidat.nom !== "string" ||
    !candidat.nom.trim()
  ) {
    return null;
  }

  return { id: candidat.id.trim(), nom: candidat.nom.trim() };
}

function documentVersLigne(document: DocumentNonClasse): LigneDocument {
  const propositionNouveauCheminDossier = normaliserCheminProposition(
    document.proposition_nouveau_chemin_dossier,
  );

  return {
    documentId: document.id,
    storagePath: document.storage_path,
    nom: document.nom_original,
    gedDossierId:
      document.proposition_ged_dossier_id ??
      (propositionNouveauCheminDossier ? NOUVEAU_DOSSIER_SELECTION : ""),
    majeurId: document.proposition_majeur_id ?? "",
    typeDocument: document.type_document,
    propositionGedDossierId: document.proposition_ged_dossier_id,
    propositionNouveauCheminDossier,
    propositionSuggestionDossierExistant: normaliserSuggestionDossierExistant(
      document.proposition_suggestion_dossier_existant,
    ),
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

function cheminManuelIncomplet(ligne: LigneDocument): boolean {
  return (
    ligne.gedDossierId === NOUVEAU_DOSSIER_MANUEL &&
    !normaliserCheminProposition(ligne.nouveauCheminManuel)
  );
}

function ligneVersParamsValidation(ligne: LigneDocument) {
  const estCheminIa = ligne.gedDossierId === NOUVEAU_DOSSIER_SELECTION;
  const estCheminManuel = ligne.gedDossierId === NOUVEAU_DOSSIER_MANUEL;

  return {
    documentId: ligne.documentId,
    gedDossierId:
      estCheminIa || estCheminManuel ? null : ligne.gedDossierId || null,
    nouveauCheminDossier: estCheminIa
      ? (ligne.propositionNouveauCheminDossier ?? null)
      : estCheminManuel
        ? normaliserCheminProposition(ligne.nouveauCheminManuel)
        : null,
    majeurId: ligne.majeurId,
    nom: ligne.nom,
  };
}

function lignePreteAValider(ligne: LigneDocument): boolean {
  return (
    Boolean(ligne.majeurId) &&
    Boolean(ligne.nom.trim()) &&
    Boolean(ligne.gedDossierId) &&
    !cheminManuelIncomplet(ligne)
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
  const [dossiers, setDossiers] = useState<GedDossier[]>([]);
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

  const dossiersParMajeur = useMemo(() => {
    const map: Record<string, GedDossier[]> = {};
    for (const dossier of dossiers) {
      const liste = map[dossier.majeur_id] ?? [];
      liste.push(dossier);
      map[dossier.majeur_id] = liste;
    }
    return map;
  }, [dossiers]);

  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const contexte = await fetchScanGedContext(organisation.organisationId);
      setDossiers(contexte.dossiers);
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
      setErreur("Formats acceptés : PDF et images.");
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
      // Recharger dossiers (nouveaux chemins pas encore créés) + docs
      const contexte = await fetchScanGedContext(organisation.organisationId);
      setDossiers(contexte.dossiers);
      setMajeurs(contexte.majeurs);
      setLignes(contexte.documents.map(documentVersLigne));

      const nb = resultat.documents.length;
      setMessage(
        `${nb} document${nb > 1 ? "s" : ""} importé${nb > 1 ? "s" : ""} et classifié${nb > 1 ? "s" : ""} par l'IA.`,
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
    if (!lignePreteAValider(ligne)) {
      setErreur(
        "Veuillez renseigner le nom, le dossier et le protégé.",
      );
      return;
    }

    setValidationDocumentId(ligne.documentId);
    setErreur(null);
    setMessage(null);

    try {
      await validerScanGedDocument(ligneVersParamsValidation(ligne));

      setLignes((courantes) =>
        courantes.filter((item) => item.documentId !== ligne.documentId),
      );
      // Dossiers peuvent avoir été créés
      const contexte = await fetchScanGedContext(organisation.organisationId);
      setDossiers(contexte.dossiers);
      setMessage("Document classé dans la GED.");
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
    const aValider = lignes.filter(lignePreteAValider);

    if (aValider.length === 0) {
      setErreur(
        "Aucun document prêt : chaque ligne doit avoir un nom, un dossier et un protégé.",
      );
      return;
    }

    setValidationEnCours(true);
    setErreur(null);
    setMessage(null);

    try {
      const resultat = await validerTousScanGedDocuments(
        aValider.map(ligneVersParamsValidation),
      );

      const idsValides = new Set(aValider.map((ligne) => ligne.documentId));
      setLignes((courantes) =>
        courantes.filter((ligne) => !idsValides.has(ligne.documentId)),
      );
      const contexte = await fetchScanGedContext(organisation.organisationId);
      setDossiers(contexte.dossiers);
      setMessage(`${resultat.succes} document(s) classé(s) dans la GED.`);

      if (resultat.erreurs?.length) {
        setErreur(resultat.erreurs.join(" | "));
      }
    } catch (error) {
      setErreur(
        error instanceof Error ? error.message : "Impossible de tout valider.",
      );
    } finally {
      setValidationEnCours(false);
    }
  }

  const mjpmLabel = organisation.mjpm
    ? `${organisation.mjpm.prenom} ${organisation.mjpm.nom}`
    : organisation.cabinetNom;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text-muted">Cabinet sélectionné</p>
          <p className="text-base font-medium text-text-strong">
            {mjpmLabel}
            {organisation.mjpm && organisation.cabinetNom ? (
              <span className="font-normal text-text-muted">
                {" "}
                · {organisation.cabinetNom}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onChangeMjpm}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-strong transition-colors hover:bg-page"
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
          "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          glisserActif
            ? "border-accent bg-accent/5"
            : "border-border bg-card",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              void traiterFichiers(event.target.files);
              event.target.value = "";
            }
          }}
        />
        <FileUp className="mx-auto mb-3 h-8 w-8 text-accent" />
        <p className="mb-1 text-sm font-medium text-text-strong">
          Déposez des PDF ou images, ou sélectionnez des fichiers
        </p>
        <p className="mb-4 text-xs text-text-muted">
          Les PDF multi-documents sont découpés automatiquement aux feuilles
          séparatrices
        </p>
        <button
          type="button"
          disabled={importEnCours}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importEnCours ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Import en cours…
            </>
          ) : (
            "Sélectionner des fichiers"
          )}
        </button>
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
            const dossiersMajeur = dossiersParMajeur[ligne.majeurId] ?? [];
            const dossiersProposition =
              dossiersParMajeur[
                ligne.propositionMajeurId ?? ligne.majeurId
              ] ?? dossiersMajeur;
            const propositionMajeur = getNomMajeur(
              majeurs,
              ligne.propositionMajeurId ?? ligne.majeurId,
            );

            let cheminIa: string | null = null;
            if (ligne.propositionGedDossierId) {
              cheminIa = formatCheminDossierBreadcrumb(
                ligne.propositionGedDossierId,
                dossiersProposition,
              );
            } else if (ligne.propositionNouveauCheminDossier?.length) {
              const segments = analyserSegmentsNouveauChemin(
                ligne.propositionNouveauCheminDossier,
                dossiersProposition,
              );
              cheminIa = formatSegmentsCheminBreadcrumb(
                segments.map((segment) => segment.libelle),
              );
            }

            const suggestion = ligne.propositionSuggestionDossierExistant;
            const libelleSuggestion = suggestion
              ? formatCheminDossierBreadcrumb(
                  suggestion.id,
                  dossiersProposition,
                ) || suggestion.nom
              : null;
            const estNouveauChemin =
              !ligne.propositionGedDossierId &&
              Boolean(ligne.propositionNouveauCheminDossier?.length);

            return (
              <div
                key={ligne.documentId}
                className="rounded-xl border border-border bg-card p-4 sm:p-5"
              >
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.2fr_1fr_1.4fr_auto]">
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
                      htmlFor={`majeur-${ligne.documentId}`}
                      className="mb-1.5 block text-xs font-medium text-text-muted"
                    >
                      Protégé
                    </label>
                    <select
                      id={`majeur-${ligne.documentId}`}
                      value={ligne.majeurId}
                      onChange={(event) => {
                        const nouveauMajeurId = event.target.value;
                        mettreAJourLigne(ligne.documentId, {
                          majeurId: nouveauMajeurId,
                          gedDossierId: ligne.propositionNouveauCheminDossier
                            ?.length
                            ? NOUVEAU_DOSSIER_SELECTION
                            : "",
                          nouveauCheminManuel: undefined,
                        });
                      }}
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

                  <GedDossierSelect
                    id={`dossier-${ligne.documentId}`}
                    label="Dossier"
                    dossiers={dossiersMajeur}
                    value={ligne.gedDossierId}
                    propositionNouveauCheminDossier={
                      ligne.propositionNouveauCheminDossier
                    }
                    nouveauCheminManuel={ligne.nouveauCheminManuel}
                    onNouveauCheminManuelChange={(segments) =>
                      mettreAJourLigne(ligne.documentId, {
                        gedDossierId: NOUVEAU_DOSSIER_MANUEL,
                        nouveauCheminManuel: segments,
                      })
                    }
                    onChange={(dossierId) =>
                      mettreAJourLigne(ligne.documentId, {
                        gedDossierId: dossierId,
                        nouveauCheminManuel:
                          dossierId === NOUVEAU_DOSSIER_MANUEL
                            ? ligne.nouveauCheminManuel ?? [""]
                            : undefined,
                      })
                    }
                    disabled={!ligne.majeurId}
                  />

                  <div className="flex flex-wrap gap-2 lg:justify-end lg:pt-6">
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
                        validationEnCours ||
                        !lignePreteAValider(ligne)
                      }
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {validationDocumentId === ligne.documentId
                        ? "Validation…"
                        : "Valider"}
                    </button>
                  </div>
                </div>

                {(cheminIa || propositionMajeur) && (
                  <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-page/60 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent" />
                      {cheminIa && (
                        <Badge variant="info">IA : {cheminIa}</Badge>
                      )}
                      {propositionMajeur && (
                        <span className="text-xs text-text-muted">
                          Protégé : {propositionMajeur}
                        </span>
                      )}
                      {ligne.propositionNom &&
                        ligne.propositionNom !== ligne.nom && (
                          <span className="text-xs text-text-muted">
                            Nom suggéré : {ligne.propositionNom}
                          </span>
                        )}
                    </div>
                    {estNouveauChemin && suggestion && libelleSuggestion && (
                      <p className="pl-6 text-xs text-text-muted">
                        Un dossier similaire existe peut-être :{" "}
                        <button
                          type="button"
                          onClick={() =>
                            mettreAJourLigne(ligne.documentId, {
                              gedDossierId: suggestion.id,
                              nouveauCheminManuel: undefined,
                            })
                          }
                          className="font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:text-accent-hover"
                        >
                          {libelleSuggestion}
                        </button>
                        {" — cliquez pour l'utiliser à la place"}
                      </p>
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
