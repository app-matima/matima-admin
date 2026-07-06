import { CLAUDE_MODEL_HAIKU } from "@/lib/claude/models";

interface CategoriePourClassification {
  id: string;
  nom: string;
}

interface ClassifyDocumentParams {
  nomOriginal: string;
  typeDocument: string;
  categories: CategoriePourClassification[];
  pdfBase64?: string | null;
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
    };

export const CATEGORIES_CLASSIFICATION = [
  "Assurance",
  "Administratif",
  "Banque",
  "CAF",
  "Santé",
  "CPAM",
  "DIPM",
  "Etat civil",
  "Facture",
  "Fiscal",
  "Logement",
  "MDPH",
  "Mutuelle",
  "Tribunal",
] as const;

export type NomCategorieClassification =
  (typeof CATEGORIES_CLASSIFICATION)[number];

function normaliserNomCategorie(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resoudreCategorieId(
  nomRetourne: string,
  categories: CategoriePourClassification[],
): string | null {
  const nomNormalise = normaliserNomCategorie(nomRetourne);

  const categorieExacte = categories.find(
    (categorie) => normaliserNomCategorie(categorie.nom) === nomNormalise,
  );

  if (categorieExacte) {
    return categorieExacte.id;
  }

  const categorieListe = CATEGORIES_CLASSIFICATION.find(
    (categorie) => normaliserNomCategorie(categorie) === nomNormalise,
  );

  if (!categorieListe) {
    return null;
  }

  return (
    categories.find(
      (categorie) =>
        normaliserNomCategorie(categorie.nom) ===
        normaliserNomCategorie(categorieListe),
    )?.id ?? null
  );
}

function construirePrompt(params: ClassifyDocumentParams): string {
  const listeCategories = CATEGORIES_CLASSIFICATION.map(
    (categorie) => `- ${categorie}`,
  ).join("\n");

  return `Tu es un classificateur de documents pour un logiciel de gestion de tutelle (MJPM) en France.

MISSION
Analyse le document PDF joint (et le nom du fichier) et choisis la catégorie la plus appropriée.

RÈGLES STRICTES
1. Retourne UNIQUEMENT le nom exact d'une catégorie ci-dessous — aucun autre texte.
2. Si le document ne correspond vraiment à aucune catégorie, retourne exactement : null

CATÉGORIES AUTORISÉES (liste fermée)
${listeCategories}

DOCUMENT À CLASSIFIER
Nom du fichier : ${params.nomOriginal}
Type MIME : ${params.typeDocument}`;
}

function construireMessageContent(
  params: ClassifyDocumentParams,
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
  }

  contenu.push({ type: "text", text: construirePrompt(params) });

  return contenu;
}

export async function classifyDocument(
  params: ClassifyDocumentParams,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || params.categories.length === 0) {
    return null;
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
        max_tokens: 32,
        messages: [{ role: "user", content: construireMessageContent(params) }],
      }),
    });

    if (!response.ok) {
      console.error("[classifyDocument] Erreur API:", await response.text());
      return null;
    }

    const result = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const texte =
      result.content.find((bloc) => bloc.type === "text")?.text?.trim() ?? "";

    if (texte.toLowerCase() === "null" || !texte) {
      return null;
    }

    return resoudreCategorieId(texte, params.categories);
  } catch (error) {
    console.error("[classifyDocument] Erreur:", error);
    return null;
  }
}
