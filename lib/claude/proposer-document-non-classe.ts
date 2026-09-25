import {
  CONSIGNES_FIXES_APPEL_B,
  INTRO_APPEL_A,
} from "@/lib/claude/classification-prompts";
import {
  modeleClassificationDossier,
  modeleClassificationProtege,
} from "@/lib/claude/models";
import { formaterDossiersOrganisationPourPrompt } from "@/lib/documents/ged-dossiers-server";
import { nomsDossiersQuasiIdentiques } from "@/lib/documents/ged-dossier-utils";
import { extrairePremierePagePdf } from "@/lib/documents/extraire-premiere-page-pdf";
import type { PropositionDocumentIA } from "@/types/documents";

export interface DossierPourProposition {
  id: string;
  nom: string;
  majeur_id: string;
  parent_id: string | null;
}

export interface MajeurPourProposition {
  id: string;
  nom: string;
  prenom: string;
}

export interface TokensUsage {
  input: number;
  output: number;
  cache_read: number;
}

export type ConfianceClassification = "haute" | "basse";

export interface IdentificationProtege {
  nomLuDansDocument: string | null;
  majeurId: string | null;
  confiance: ConfianceClassification;
  tokens: TokensUsage | null;
}

export interface ClassementDossier {
  emetteur: string | null;
  typeDocument: string | null;
  famille: string | null;
  gedDossierId: string | null;
  nouveauCheminDossier: string[] | null;
  nomFichier: string | null;
  confiance: ConfianceClassification;
  tokens: TokensUsage | null;
}

interface ProposerDocumentParams {
  nomOriginal: string;
  typeDocument: string;
  majeurs: MajeurPourProposition[];
  /** Charge l'arborescence du protégé (appel B uniquement). */
  chargerDossiers: (
    majeurId: string,
  ) => Promise<DossierPourProposition[]>;
  pdfBytes?: Uint8Array | null;
  imageBase64?: string | null;
  imageMediaType?: string;
}

interface ChoisirDossierParams {
  nomOriginal: string;
  typeDocument: string;
  majeur: MajeurPourProposition;
  dossiers: DossierPourProposition[];
  pdfBytes?: Uint8Array | null;
  imageBase64?: string | null;
  imageMediaType?: string;
}

type MessageContent =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: "application/pdf";
        data: string;
      };
    }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        data: string;
      };
    };

interface ReponseIdentificationJson {
  nom_lu_dans_document?: string | null;
  majeur_id?: string | null;
  confiance?: string | null;
}

interface ReponseDossierJson {
  emetteur?: string | null;
  type_document?: string | null;
  famille?: string | null;
  dossier_id?: string | null;
  nouveau_chemin_dossier?: unknown;
  nouveau_dossier_nom?: string | null;
  nom_fichier?: string | null;
  confiance?: string | null;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface AnthropicMessagesResponse {
  content: { type: string; text: string }[];
  usage?: AnthropicUsage;
}

function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function resoudreMajeurId(
  valeur: string,
  majeurs: MajeurPourProposition[],
): string | null {
  const normalise = normaliserTexte(valeur);

  const parId = majeurs.find((majeur) => majeur.id === valeur);
  if (parId) {
    return parId.id;
  }

  return (
    majeurs.find((majeur) => {
      const nomComplet = `${majeur.nom} ${majeur.prenom}`;
      const prenomNom = `${majeur.prenom} ${majeur.nom}`;
      return (
        normaliserTexte(nomComplet) === normalise ||
        normaliserTexte(prenomNom) === normalise
      );
    })?.id ?? null
  );
}

export function resoudreDossierId(
  valeur: string,
  majeurId: string | null,
  dossiers: DossierPourProposition[],
): string | null {
  if (!majeurId || !valeur || valeur === "null") {
    return null;
  }

  const dossiersDuMajeur = dossiers.filter(
    (dossier) => dossier.majeur_id === majeurId,
  );

  const parId = dossiersDuMajeur.find((dossier) => dossier.id === valeur);
  if (parId) {
    return parId.id;
  }

  const nomNormalise = normaliserTexte(valeur);
  const correspondancesExactes = dossiersDuMajeur.filter(
    (dossier) => normaliserTexte(dossier.nom) === nomNormalise,
  );

  if (correspondancesExactes.length === 1) {
    return correspondancesExactes[0]!.id;
  }

  const correspondancesProches = dossiersDuMajeur.filter((dossier) =>
    nomsDossiersQuasiIdentiques(dossier.nom, valeur),
  );

  return correspondancesProches.length === 1
    ? correspondancesProches[0]!.id
    : null;
}

function normaliserNouveauCheminDossier(json: {
  nouveau_chemin_dossier?: unknown;
  nouveau_dossier_nom?: string | null;
}): string[] | null {
  if (Array.isArray(json.nouveau_chemin_dossier)) {
    const segments = json.nouveau_chemin_dossier
      .filter((segment): segment is string => typeof segment === "string")
      .map((segment) => segment.trim())
      .filter(Boolean);

    return segments.length > 0 ? segments : null;
  }

  if (
    typeof json.nouveau_dossier_nom === "string" &&
    json.nouveau_dossier_nom !== "null"
  ) {
    const segment = json.nouveau_dossier_nom.trim();
    return segment ? [segment] : null;
  }

  return null;
}

function champOptionnel(valeur: string | null | undefined): string | null {
  if (typeof valeur !== "string") {
    return null;
  }
  const trimme = valeur.trim();
  if (!trimme || trimme === "null") {
    return null;
  }
  return trimme;
}

function normaliserConfiance(valeur: string | null | undefined): ConfianceClassification {
  return champOptionnel(valeur)?.toLowerCase() === "haute" ? "haute" : "basse";
}

function extraireTokens(usage: AnthropicUsage | undefined): TokensUsage {
  return {
    input: usage?.input_tokens ?? 0,
    output: usage?.output_tokens ?? 0,
    cache_read: usage?.cache_read_input_tokens ?? 0,
  };
}

function formaterTokens(tokens: TokensUsage | null): string {
  if (!tokens) {
    return "n/a";
  }
  return `in=${tokens.input} out=${tokens.output} cache_read=${tokens.cache_read}`;
}

function parserReponseJson<T>(texte: string): T | null {
  try {
    return JSON.parse(texte) as T;
  } catch {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    if (debut === -1 || fin === -1) {
      return null;
    }

    try {
      return JSON.parse(texte.slice(debut, fin + 1)) as T;
    } catch {
      return null;
    }
  }
}

function construireMediaContent(params: {
  pdfBase64?: string | null;
  imageBase64?: string | null;
  imageMediaType?: string;
}): MessageContent[] {
  const contenu: MessageContent[] = [];

  if (params.pdfBase64) {
    contenu.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: params.pdfBase64,
      },
    });
  } else if (params.imageBase64 && params.imageMediaType) {
    const mediaType = params.imageMediaType as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    contenu.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: params.imageBase64,
      },
    });
  }

  return contenu;
}

async function appelerAnthropic(params: {
  model: string;
  maxTokens: number;
  system?:
    | string
    | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[];
  messages: { role: "user"; content: MessageContent[] }[];
  label: string;
}): Promise<{ texte: string; tokens: TokensUsage }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquante");
  }

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens,
        temperature: 0,
        ...(params.system ? { system: params.system } : {}),
        messages: params.messages,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur réseau Anthropic.";
    throw new Error(`${params.label}: ${message}`);
  }

  if (!response.ok) {
    const corps = await response.text();
    throw new Error(
      `${params.label}: erreur API HTTP ${response.status}${corps ? ` — ${corps.slice(0, 200)}` : ""}`,
    );
  }

  const result = (await response.json()) as AnthropicMessagesResponse;
  const texte =
    result.content.find((bloc) => bloc.type === "text")?.text?.trim() ?? "";

  if (!texte) {
    throw new Error(`${params.label}: réponse API vide.`);
  }

  return { texte, tokens: extraireTokens(result.usage) };
}

function construirePromptIdentification(
  majeurs: MajeurPourProposition[],
  nomOriginal: string,
  typeDocument: string,
): string {
  const majeursListe = majeurs
    .map((majeur) => `- ${majeur.nom} ${majeur.prenom} (id: ${majeur.id})`)
    .join("\n");

  return `${INTRO_APPEL_A}

<proteges_actifs>
${majeursListe}
</proteges_actifs>

<fichier>
Nom du fichier source : ${nomOriginal}
Type MIME : ${typeDocument}
</fichier>`;
}

function construireTexteVariableDossier(params: {
  majeur: MajeurPourProposition;
  dossiers: DossierPourProposition[];
  nomOriginal: string;
  typeDocument: string;
}): string {
  const arborescence = formaterDossiersOrganisationPourPrompt(
    params.dossiers,
    params.majeur.id,
  );

  return `<protege>
${params.majeur.nom} ${params.majeur.prenom} (id: ${params.majeur.id})
</protege>

<arborescence_du_protege>
${arborescence}
</arborescence_du_protege>

<fichier>
Nom du fichier source : ${params.nomOriginal}
Type MIME : ${params.typeDocument}
</fichier>`;
}

/**
 * Appel A — identification du protégé (1ʳᵉ page PDF ou image entière).
 * Lève une erreur en cas d'échec API / réponse invalide.
 */
export async function identifierProtege(params: {
  nomOriginal: string;
  typeDocument: string;
  majeurs: MajeurPourProposition[];
  pdfBytes?: Uint8Array | null;
  imageBase64?: string | null;
  imageMediaType?: string;
}): Promise<IdentificationProtege> {
  let pdfBase64: string | null = null;

  if (params.pdfBytes && params.pdfBytes.byteLength > 0) {
    const premierePage = await extrairePremierePagePdf(params.pdfBytes);
    const bytesPourA = premierePage ?? params.pdfBytes;
    pdfBase64 = Buffer.from(bytesPourA).toString("base64");
  }

  const media = construireMediaContent({
    pdfBase64,
    imageBase64: params.imageBase64,
    imageMediaType: params.imageMediaType,
  });

  if (media.length === 0) {
    throw new Error("Document illisible pour l'identification du protégé.");
  }

  const prompt = construirePromptIdentification(
    params.majeurs,
    params.nomOriginal,
    params.typeDocument,
  );

  const reponse = await appelerAnthropic({
    model: modeleClassificationProtege(),
    maxTokens: 300,
    label: "identifierProtege",
    messages: [
      {
        role: "user",
        content: [...media, { type: "text", text: prompt }],
      },
    ],
  });

  const json = parserReponseJson<ReponseIdentificationJson>(reponse.texte);
  if (!json) {
    throw new Error("Réponse d'identification du protégé invalide.");
  }

  const majeurIdBrut = champOptionnel(json.majeur_id);
  const majeurId = majeurIdBrut
    ? resoudreMajeurId(majeurIdBrut, params.majeurs)
    : null;

  return {
    nomLuDansDocument: champOptionnel(json.nom_lu_dans_document),
    majeurId,
    confiance: normaliserConfiance(json.confiance),
    tokens: reponse.tokens,
  };
}

/**
 * Appel B — choix du dossier (document complet, consignes en system cache).
 * Lève une erreur en cas d'échec API / réponse invalide.
 */
export async function choisirDossierPourProtege(
  params: ChoisirDossierParams,
): Promise<ClassementDossier> {
  const pdfBase64 =
    params.pdfBytes && params.pdfBytes.byteLength > 0
      ? Buffer.from(params.pdfBytes).toString("base64")
      : null;

  const media = construireMediaContent({
    pdfBase64,
    imageBase64: params.imageBase64,
    imageMediaType: params.imageMediaType,
  });

  if (media.length === 0) {
    throw new Error("Document illisible pour le choix du dossier.");
  }

  const texteVariable = construireTexteVariableDossier({
    majeur: params.majeur,
    dossiers: params.dossiers,
    nomOriginal: params.nomOriginal,
    typeDocument: params.typeDocument,
  });

  const reponse = await appelerAnthropic({
    model: modeleClassificationDossier(),
    maxTokens: 800,
    label: "choisirDossierPourProtege",
    system: [
      {
        type: "text",
        text: CONSIGNES_FIXES_APPEL_B,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [...media, { type: "text", text: texteVariable }],
      },
    ],
  });

  const json = parserReponseJson<ReponseDossierJson>(reponse.texte);
  if (!json) {
    throw new Error("Réponse de choix de dossier invalide.");
  }

  const dossierIdBrut = champOptionnel(json.dossier_id);
  const gedDossierId = dossierIdBrut
    ? resoudreDossierId(dossierIdBrut, params.majeur.id, params.dossiers)
    : null;

  const nouveauCheminDossier = !gedDossierId
    ? normaliserNouveauCheminDossier(json)
    : null;

  return {
    emetteur: champOptionnel(json.emetteur),
    typeDocument: champOptionnel(json.type_document),
    famille: champOptionnel(json.famille),
    gedDossierId,
    nouveauCheminDossier,
    nomFichier: champOptionnel(json.nom_fichier),
    confiance: normaliserConfiance(json.confiance),
    tokens: reponse.tokens,
  };
}

function loguerClassificationDeuxTemps(params: {
  fichier: string;
  identification: IdentificationProtege;
  classement: ClassementDossier | null;
  confianceGlobale: ConfianceClassification;
}): void {
  const dossierChoisi =
    params.classement?.gedDossierId ??
    (params.classement?.nouveauCheminDossier
      ? params.classement.nouveauCheminDossier.join(" > ")
      : null);

  console.log(
    "[proposerDocumentNonClasse]",
    params.fichier,
    "nom_lu=",
    params.identification.nomLuDansDocument,
    "majeur_id=",
    params.identification.majeurId,
    "emetteur=",
    params.classement?.emetteur ?? null,
    "type_document=",
    params.classement?.typeDocument ?? null,
    "famille=",
    params.classement?.famille ?? null,
    "dossier=",
    dossierChoisi,
    "confiance_A=",
    params.identification.confiance,
    "confiance_B=",
    params.classement?.confiance ?? null,
    "confiance_globale=",
    params.confianceGlobale,
    "tokens_A=",
    formaterTokens(params.identification.tokens),
    "tokens_B=",
    formaterTokens(params.classement?.tokens ?? null),
  );
}

/**
 * Classement en deux temps : A (protégé) puis B (dossier) si majeur trouvé.
 * Propage les erreurs API / réponses invalides (pour la file d'attente).
 */
export async function proposerDocumentNonClasse(
  params: ProposerDocumentParams,
): Promise<PropositionDocumentIA> {
  const identification = await identifierProtege({
    nomOriginal: params.nomOriginal,
    typeDocument: params.typeDocument,
    majeurs: params.majeurs,
    pdfBytes: params.pdfBytes,
    imageBase64: params.imageBase64,
    imageMediaType: params.imageMediaType,
  });

  if (!identification.majeurId) {
    loguerClassificationDeuxTemps({
      fichier: params.nomOriginal,
      identification,
      classement: null,
      confianceGlobale: identification.confiance,
    });

    return {
      gedDossierId: null,
      majeurId: null,
      nomFichier: null,
      nouveauCheminDossier: null,
    };
  }

  const majeur = params.majeurs.find(
    (item) => item.id === identification.majeurId,
  );

  if (!majeur) {
    loguerClassificationDeuxTemps({
      fichier: params.nomOriginal,
      identification: { ...identification, majeurId: null },
      classement: null,
      confianceGlobale: "basse",
    });

    return {
      gedDossierId: null,
      majeurId: null,
      nomFichier: null,
      nouveauCheminDossier: null,
    };
  }

  const dossiers = await params.chargerDossiers(majeur.id);

  const classement = await choisirDossierPourProtege({
    nomOriginal: params.nomOriginal,
    typeDocument: params.typeDocument,
    majeur,
    dossiers,
    pdfBytes: params.pdfBytes,
    imageBase64: params.imageBase64,
    imageMediaType: params.imageMediaType,
  });

  const confianceGlobale: ConfianceClassification =
    identification.confiance === "haute" && classement.confiance === "haute"
      ? "haute"
      : "basse";

  loguerClassificationDeuxTemps({
    fichier: params.nomOriginal,
    identification,
    classement,
    confianceGlobale,
  });

  return {
    gedDossierId: classement.gedDossierId,
    majeurId: majeur.id,
    nomFichier: classement.nomFichier,
    nouveauCheminDossier: classement.nouveauCheminDossier,
  };
}
