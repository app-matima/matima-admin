import { CLAUDE_MODEL_HAIKU } from "@/lib/claude/models";
import { formaterDossiersOrganisationPourPrompt } from "@/lib/documents/ged-dossiers-server";
import { nomsDossiersQuasiIdentiques } from "@/lib/documents/ged-dossier-utils";
import type { PropositionDocumentIA } from "@/types/documents";

interface DossierPourProposition {
  id: string;
  nom: string;
  majeur_id: string;
  parent_id: string | null;
}

interface MajeurPourProposition {
  id: string;
  nom: string;
  prenom: string;
}

interface ProposerDocumentParams {
  nomOriginal: string;
  typeDocument: string;
  dossiers: DossierPourProposition[];
  majeurs: MajeurPourProposition[];
  pdfBase64?: string | null;
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

interface ReponseClassificationJson {
  majeur_id?: string | null;
  dossier_id?: string | null;
  nouveau_chemin_dossier?: unknown;
  nouveau_dossier_nom?: string | null;
  nom_fichier?: string | null;
  confiance?: string | null;
}

function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resoudreMajeurId(
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

function construirePrompt(params: ProposerDocumentParams): string {
  const majeursListe = params.majeurs
    .map((majeur) => `- ${majeur.nom} ${majeur.prenom} (id: ${majeur.id})`)
    .join("\n");

  const dossiersParMajeur = params.majeurs
    .map((majeur) => {
      const liste = formaterDossiersOrganisationPourPrompt(
        params.dossiers,
        majeur.id,
      );

      return `${majeur.nom} ${majeur.prenom} :\n${liste}`;
    })
    .join("\n\n");

  return `Tu es un assistant de classement documentaire pour un logiciel MJPM en France.

Analyse le document joint et le nom du fichier, puis propose :
1. Le protégé (majeur) concerné — UNIQUEMENT parmi la liste « Protégés actifs » ci-dessous
2. Le dossier existant le plus adapté (dossier_id) — à N'IMPORTE QUEL niveau de l'arborescence listée, pas seulement à la racine
3. Si aucun dossier existant ne convient vraiment, propose un NOUVEAU chemin complet depuis la racine (nouveau_chemin_dossier : tableau de noms de dossiers, un segment par niveau)
4. Un nom de fichier court, clair et descriptif (avec extension)
5. Ta confiance globale ("haute" ou "basse") sur l'identification du protégé ET du dossier précis (ou du nouveau chemin)

Identification du protégé (CRITIQUE — lire avant de choisir majeur_id) :
- Le majeur_id DOIT être l'UUID exact d'un protégé de la liste « Protégés actifs ». N'invente jamais d'id. N'utilise jamais un nom hors liste.
- IGNORE systématiquement tout nom associé à des mentions du type : « tuteur », « curateur », « curatelle », « tutelle », « mandataire judiciaire », « MJPM », « représentant légal », « pour le compte de », en-tête / signature / cachet du cabinet. Ce n'est PAS le protégé recherché (c'est souvent le MJPM visible en en-tête).
- Cherche plutôt le nom du SUJET du document : mentions « concernant », « à l'attention de », « bénéficiaire », « assuré », « patient », « allocataire », « destinataire », objet du courrier (« M./Mme … »), ou le nom qui apparaît comme personne principale du contenu (pas le signataire administratif).
- Si, après avoir écarté le nom du MJPM / représentant légal, aucun nom du document ne correspond CLAIREMENT à un protégé de la liste, renvoie majeur_id: null. Ne devine PAS le protégé le plus « proche » ou le plus probable au hasard. Mieux vaut null qu'une attribution erronée.
- confiance = "basse" (ou majeur_id null) dès que l'identité du protégé est ambiguë.

Méthode de raisonnement (à appliquer avant de répondre) :
Réfléchis d'abord au TYPE de document (pièce d'identité, facture, courrier officiel, document médical, relevé bancaire, document juridique...) avant de choisir le dossier. Exemples : une carte d'identité ou un passeport doit aller dans un dossier lié à l'identité/état civil, jamais dans un dossier de factures. Un relevé bancaire va dans un dossier lié à la banque, jamais dans un dossier de santé. Si le type de document ne correspond à AUCUN dossier existant, propose TOUJOURS un nouveau dossier plutôt que de forcer un mauvais classement — c'est préférable à une erreur de classement sur un document sensible.

Organisation multi-niveaux :
- Tu peux proposer un chemin à plusieurs niveaux si cela organise mieux le document (ex. ["Identité", "Cartes et papiers"] plutôt que ["Identité"] seul)
- Utilise dossier_id si un dossier existant listé correspond déjà clairement, quel que soit son niveau
- Utilise nouveau_chemin_dossier uniquement si aucun dossier existant ne convient ; crée alors tout le chemin nécessaire depuis la racine
- Anti-doublons obligatoires : un dossier existant au singulier ou au pluriel (ex. « Attestation » / « Attestations »), ou à une formulation très proche (casse, accents, espaces), EST CE DOSSIER. Réutilise-le via dossier_id — ne propose JAMAIS un nouveau_chemin_dossier qui ne fait que reformuler légèrement un nom déjà listé

Précision du classement :
Sois précis dans ton classement. Ne te contente JAMAIS d'un dossier racine générique si un sous-dossier plus spécifique serait plus pertinent. Exemples : une facture doit être classée dans un sous-dossier portant le nom de l'entreprise émettrice (ex: 'Factures > EDF', 'Factures > Orange'), pas directement dans 'Factures'. Un document d'identité doit être classé dans un sous-dossier précis selon son type (ex: 'Identité > Carte nationale d'identité', 'Identité > Passeport'), pas directement dans 'Identité'. Un document médical doit préciser le type ou le praticien si identifiable (ex: 'Santé > Médecin traitant', 'Santé > Analyses'). Si tu identifies un élément spécifique dans le document (nom d'entreprise, type précis de document, nom de praticien...), utilise-le TOUJOURS pour créer ou choisir un sous-dossier précis plutôt que de rester au niveau générique. Si un sous-dossier quasi-identique existe déjà (singulier/pluriel ou formulation proche), réutilise-le plutôt que d'en inventer un nouveau.

Règles :
- Ne force jamais un dossier existant si aucun ne correspond au contenu : utilise nouveau_chemin_dossier à la place
- Utilise dossier_id uniquement si un dossier listé correspond clairement (y compris singulier/pluriel ou formulation très proche)
- Ne mets pas dossier_id et nouveau_chemin_dossier en même temps
- nouveau_chemin_dossier doit être un tableau JSON de strings (1 à 4 segments), jamais null si tu proposes une création
- confiance = "haute" uniquement si tu es sûr à la fois du protégé ET du dossier (ou chemin) précis ; sinon "basse"
- Si majeur_id est null, dossier_id et nouveau_chemin_dossier doivent aussi être null (pas de classement dossier sans protégé)

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"majeur_id":"uuid ou null","dossier_id":"uuid ou null","nouveau_chemin_dossier":["Segment 1","Segment 2"] ou null,"nom_fichier":"nom_suggere.pdf","confiance":"haute ou basse"}

Protégés actifs (seules valeurs autorisées pour majeur_id) :
${majeursListe}

Dossiers existants par protégé (chemin complet depuis la racine) :
${dossiersParMajeur}

Fichier source : ${params.nomOriginal}
Type MIME : ${params.typeDocument}`;
}

function construireMessageContent(
  params: ProposerDocumentParams,
): MessageContent[] {
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

  contenu.push({ type: "text", text: construirePrompt(params) });
  return contenu;
}

function parserReponseJson(texte: string): ReponseClassificationJson | null {
  try {
    return JSON.parse(texte) as ReponseClassificationJson;
  } catch {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    if (debut === -1 || fin === -1) {
      return null;
    }

    try {
      return JSON.parse(
        texte.slice(debut, fin + 1),
      ) as ReponseClassificationJson;
    } catch {
      return null;
    }
  }
}

function interpreterProposition(
  json: ReponseClassificationJson,
  params: ProposerDocumentParams,
): PropositionDocumentIA {
  const majeurId =
    json.majeur_id && json.majeur_id !== "null"
      ? resoudreMajeurId(json.majeur_id, params.majeurs)
      : null;

  const gedDossierId =
    json.dossier_id && json.dossier_id !== "null"
      ? resoudreDossierId(json.dossier_id, majeurId, params.dossiers)
      : null;

  const nouveauCheminDossier = !gedDossierId
    ? normaliserNouveauCheminDossier(json)
    : null;

  const nomFichier =
    json.nom_fichier && json.nom_fichier !== "null"
      ? json.nom_fichier.trim()
      : null;

  return { gedDossierId, majeurId, nomFichier, nouveauCheminDossier };
}

export async function proposerDocumentNonClasse(
  params: ProposerDocumentParams,
): Promise<PropositionDocumentIA> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("[proposerDocumentNonClasse] ANTHROPIC_API_KEY manquante");
    return {
      gedDossierId: null,
      majeurId: null,
      nomFichier: null,
      nouveauCheminDossier: null,
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL_HAIKU,
        max_tokens: 512,
        messages: [
          { role: "user", content: construireMessageContent(params) },
        ],
      }),
    });

    if (!response.ok) {
      console.error(
        "[proposerDocumentNonClasse] Erreur API:",
        await response.text(),
      );
      return {
        gedDossierId: null,
        majeurId: null,
        nomFichier: null,
        nouveauCheminDossier: null,
      };
    }

    const result = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const texte =
      result.content.find((bloc) => bloc.type === "text")?.text?.trim() ?? "";
    const json = parserReponseJson(texte);

    if (!json) {
      return {
        gedDossierId: null,
        majeurId: null,
        nomFichier: null,
        nouveauCheminDossier: null,
      };
    }

    return interpreterProposition(json, params);
  } catch (error) {
    console.error("[proposerDocumentNonClasse] Erreur:", error);
    return {
      gedDossierId: null,
      majeurId: null,
      nomFichier: null,
      nouveauCheminDossier: null,
    };
  }
}
