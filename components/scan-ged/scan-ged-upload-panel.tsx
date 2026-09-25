"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, FileUp, Loader2, Sparkles, Trash2, X } from "lucide-react";
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
  fetchDossiersProtege,
  fetchScanGedContext,
  proposerDossierScanGedDocument,
  reessayerClassementScanGedDocument,
  supprimerScanGedDocument,
  uploadScanGedDocuments,
  validerScanGedDocument,
  validerTousScanGedDocuments,
  type DocumentNonClasse,
  type GedDossier,
  type MajeurActif,
} from "@/lib/scan-ged/client";
import {
  STATUT_CLASSEMENT_CLASSE,
  STATUT_CLASSEMENT_ECHEC,
  STATUT_CLASSEMENT_EN_ATTENTE,
} from "@/lib/documents/scan-ged-file-attente";
import type { StatutClassementDocument } from "@/types/documents";
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
  statutClassement: StatutClassementDocument | null;
  erreurClassement: string | null;
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

  const statutBrut = document.statut_classement;
  const statutClassement: StatutClassementDocument | null =
    statutBrut === STATUT_CLASSEMENT_EN_ATTENTE ||
    statutBrut === STATUT_CLASSEMENT_CLASSE ||
    statutBrut === STATUT_CLASSEMENT_ECHEC
      ? statutBrut
      : STATUT_CLASSEMENT_CLASSE;

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
    statutClassement,
    erreurClassement: document.erreur_classement?.trim() || null,
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
  if (ligne.statutClassement !== STATUT_CLASSEMENT_CLASSE) {
    return false;
  }

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
  const [dossiersParMajeur, setDossiersParMajeur] = useState<
    Record<string, GedDossier[]>
  >({});
  const [chargementDossiersMajeurId, setChargementDossiersMajeurId] = useState<
    string | null
  >(null);
  const [majeurs, setMajeurs] = useState<MajeurActif[]>([]);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [chargement, setChargement] = useState(true);
  const [importEnCours, setImportEnCours] = useState(false);
  const [validationEnCours, setValidationEnCours] = useState(false);
  const [validationDocumentId, setValidationDocumentId] = useState<
    string | null
  >(null);
  const [suppressionDocumentId, setSuppressionDocumentId] = useState<
    string | null
  >(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [glisserActif, setGlisserActif] = useState(false);
  const [previewLigne, setPreviewLigne] = useState<LigneDocument | null>(null);
  const [progressionClassement, setProgressionClassement] = useState<{
    fait: number;
    total: number;
  } | null>(null);
  const [reessaiDocumentId, setReessaiDocumentId] = useState<string | null>(
    null,
  );

  const assurerDossiersProtege = useCallback(
    async (majeurId: string): Promise<GedDossier[]> => {
      if (!majeurId) {
        return [];
      }

      const dejaCharges = dossiersParMajeur[majeurId];
      if (dejaCharges) {
        return dejaCharges;
      }

      setChargementDossiersMajeurId(majeurId);
      try {
        const dossiers = await fetchDossiersProtege(
          organisation.organisationId,
          majeurId,
        );
        setDossiersParMajeur((courant) => ({
          ...courant,
          [majeurId]: dossiers,
        }));
        return dossiers;
      } finally {
        setChargementDossiersMajeurId((courant) =>
          courant === majeurId ? null : courant,
        );
      }
    },
    [dossiersParMajeur, organisation.organisationId],
  );

  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const contexte = await fetchScanGedContext(organisation.organisationId);
      setMajeurs(contexte.majeurs);
      const nouvellesLignes = contexte.documents.map(documentVersLigne);
      setLignes(nouvellesLignes);

      const majeursACharger = [
        ...new Set(
          nouvellesLignes
            .flatMap((ligne) => [ligne.majeurId, ligne.propositionMajeurId])
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      if (majeursACharger.length > 0) {
        const charges = await Promise.all(
          majeursACharger.map(async (majeurId) => {
            const dossiers = await fetchDossiersProtege(
              organisation.organisationId,
              majeurId,
            );
            return [majeurId, dossiers] as const;
          }),
        );
        setDossiersParMajeur(Object.fromEntries(charges));
      } else {
        setDossiersParMajeur({});
      }
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

  async function changerProtegeLigne(
    ligne: LigneDocument,
    nouveauMajeurId: string,
  ) {
    if (ligne.statutClassement !== STATUT_CLASSEMENT_CLASSE) {
      return;
    }

    if (!nouveauMajeurId) {
      mettreAJourLigne(ligne.documentId, {
        majeurId: "",
        gedDossierId: "",
        nouveauCheminManuel: undefined,
      });
      return;
    }

    mettreAJourLigne(ligne.documentId, {
      majeurId: nouveauMajeurId,
      gedDossierId: "",
      nouveauCheminManuel: undefined,
    });

    try {
      const documentMisAJour = await proposerDossierScanGedDocument({
        organisationId: organisation.organisationId,
        documentId: ligne.documentId,
        majeurId: nouveauMajeurId,
      });

      const ligneMiseAJour = documentVersLigne(documentMisAJour);
      mettreAJourLigne(ligne.documentId, {
        ...ligneMiseAJour,
        majeurId: nouveauMajeurId,
      });
      await assurerDossiersProtege(nouveauMajeurId);
    } catch (error) {
      setErreur(
        error instanceof Error
          ? error.message
          : "Impossible de proposer un dossier pour ce protégé.",
      );
      await assurerDossiersProtege(nouveauMajeurId);
    }
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
    setProgressionClassement({ fait: 0, total: liste.length });

    try {
      const resultat = await uploadScanGedDocuments(
        organisation.organisationId,
        liste,
        {
          onProgress: (progress) => setProgressionClassement(progress),
        },
      );
      await chargerDonnees();

      const nb = resultat.documents.length;
      const nbEchecs = resultat.documents.filter(
        (doc) => doc.statut_classement === STATUT_CLASSEMENT_ECHEC,
      ).length;

      setMessage(
        nbEchecs > 0
          ? `${nb} document${nb > 1 ? "s" : ""} traité${nb > 1 ? "s" : ""} (${nbEchecs} échec${nbEchecs > 1 ? "s" : ""}).`
          : `${nb} document${nb > 1 ? "s" : ""} importé${nb > 1 ? "s" : ""} et classifié${nb > 1 ? "s" : ""} par l'IA.`,
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
      setProgressionClassement(null);
    }
  }

  async function handleReessayerLigne(ligne: LigneDocument) {
    setReessaiDocumentId(ligne.documentId);
    setErreur(null);
    setMessage(null);

    mettreAJourLigne(ligne.documentId, {
      statutClassement: STATUT_CLASSEMENT_EN_ATTENTE,
      erreurClassement: null,
    });

    try {
      const document = await reessayerClassementScanGedDocument({
        organisationId: organisation.organisationId,
        documentId: ligne.documentId,
      });
      const ligneMiseAJour = documentVersLigne(document);
      mettreAJourLigne(ligne.documentId, ligneMiseAJour);
      if (ligneMiseAJour.majeurId) {
        await assurerDossiersProtege(ligneMiseAJour.majeurId);
      }
      if (ligneMiseAJour.statutClassement === STATUT_CLASSEMENT_ECHEC) {
        setErreur(
          ligneMiseAJour.erreurClassement ??
            "Le classement a de nouveau échoué.",
        );
      } else {
        setMessage("Document reclassé.");
      }
    } catch (error) {
      setErreur(
        error instanceof Error
          ? error.message
          : "Impossible de relancer le classement.",
      );
      mettreAJourLigne(ligne.documentId, {
        statutClassement: STATUT_CLASSEMENT_ECHEC,
        erreurClassement:
          error instanceof Error
            ? error.message
            : "Impossible de relancer le classement.",
      });
    } finally {
      setReessaiDocumentId(null);
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
      if (ligne.majeurId) {
        const dossiers = await fetchDossiersProtege(
          organisation.organisationId,
          ligne.majeurId,
        );
        setDossiersParMajeur((courant) => ({
          ...courant,
          [ligne.majeurId]: dossiers,
        }));
      }
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

  async function handleSupprimerLigne(ligne: LigneDocument) {
    const confirme = window.confirm(
      `Supprimer définitivement « ${ligne.nom} » ?\n\nLe fichier sera retiré de l'attente et du Storage.`,
    );
    if (!confirme) {
      return;
    }

    setSuppressionDocumentId(ligne.documentId);
    setErreur(null);
    setMessage(null);

    try {
      await supprimerScanGedDocument(ligne.documentId);
      setLignes((courantes) =>
        courantes.filter((item) => item.documentId !== ligne.documentId),
      );
      setMessage("Document supprimé.");
    } catch (error) {
      setErreur(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer le document.",
      );
    } finally {
      setSuppressionDocumentId(null);
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
          Upload direct vers le Storage (pas de limite 4,5&nbsp;Mo). Les PDF
          multi-documents sont découpés automatiquement aux feuilles
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

      {progressionClassement && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-strong">
              Classement IA en cours…
            </p>
            <p className="text-sm text-text-muted">
              {progressionClassement.fait}/{progressionClassement.total}{" "}
              document
              {progressionClassement.total > 1 ? "s" : ""} classé
              {progressionClassement.total > 1 ? "s" : ""}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-page">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{
                width: `${
                  progressionClassement.total > 0
                    ? Math.min(
                        100,
                        (progressionClassement.fait /
                          progressionClassement.total) *
                          100,
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

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
            disabled={
              validationEnCours || importEnCours || suppressionDocumentId !== null
            }
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

            const estClasse =
              ligne.statutClassement === STATUT_CLASSEMENT_CLASSE;
            const estEchec =
              ligne.statutClassement === STATUT_CLASSEMENT_ECHEC;
            const estEnAttente =
              ligne.statutClassement === STATUT_CLASSEMENT_EN_ATTENTE;

            return (
              <div
                key={ligne.documentId}
                className={cn(
                  "rounded-xl border bg-card p-4 sm:p-5",
                  estEchec
                    ? "border-[#FECACA]"
                    : estEnAttente
                      ? "border-[#FDE68A]"
                      : "border-border",
                )}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {estEnAttente && (
                    <Badge variant="warning">En attente de classement</Badge>
                  )}
                  {estEchec && (
                    <Badge variant="danger">Échec de classement</Badge>
                  )}
                  {estClasse && (
                    <Badge variant="success">Classé — à valider</Badge>
                  )}
                </div>

                {estEchec && ligne.erreurClassement && (
                  <div className="mb-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
                    <p className="text-xs text-[#991B1B]">
                      {ligne.erreurClassement}
                    </p>
                  </div>
                )}

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
                      disabled={!estClasse}
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
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
                        void changerProtegeLigne(ligne, event.target.value);
                      }}
                      disabled={
                        !estClasse ||
                        chargementDossiersMajeurId === ligne.majeurId
                      }
                      className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
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
                    disabled={!estClasse || !ligne.majeurId}
                  />

                  <div className="flex flex-wrap gap-2 lg:justify-end lg:pt-6">
                    {estEchec && (
                      <button
                        type="button"
                        onClick={() => void handleReessayerLigne(ligne)}
                        disabled={
                          reessaiDocumentId === ligne.documentId ||
                          importEnCours
                        }
                        className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-sm font-medium text-[#B45309] transition-colors hover:bg-[#FEF3C7] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reessaiDocumentId === ligne.documentId
                          ? "Nouvelle tentative…"
                          : "Réessayer"}
                      </button>
                    )}
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
                      onClick={() => void handleSupprimerLigne(ligne)}
                      disabled={
                        suppressionDocumentId === ligne.documentId ||
                        validationDocumentId === ligne.documentId ||
                        validationEnCours ||
                        importEnCours ||
                        reessaiDocumentId === ligne.documentId
                      }
                      className="rounded-lg border border-[#FECACA] px-3 py-2 text-sm font-medium text-[#991B1B] transition-colors hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {suppressionDocumentId === ligne.documentId ? (
                        "Suppression…"
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Supprimer
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleValiderLigne(ligne)}
                      disabled={
                        validationDocumentId === ligne.documentId ||
                        suppressionDocumentId === ligne.documentId ||
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

                {(cheminIa || propositionMajeur) && estClasse && (
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
