import { CATEGORIES_CLASSIFICATION } from "@/lib/claude/classify-document";
import { CLAUDE_MODEL_HAIKU } from "@/lib/claude/models";
import type { PropositionDocumentIA } from "@/types/documents";

interface CategoriePourProposition {
  id: string;
  nom: string;
}

interface MajeurPourProposition {
  id: string;
  nom: string;
  prenom: string;
}

interface ProposerDocumentParams {
  nomOriginal: string;
  typeDocument: string;
  categories: CategoriePourProposition[];
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

function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resoudreCategorieId(
  nomRetourne: string,
  categories: CategoriePourProposition[],
): string | null {
  const nomNormalise = normaliserTexte(nomRetourne);

  const exacte = categories.find(
    (categorie) => normaliserTexte(categorie.nom) === nomNormalise,
  );
  if (exacte) {
    return exacte.id;
  }

  const liste = CATEGORIES_CLASSIFICATION.find(
    (categorie) => normaliserTexte(categorie) === nomNormalise,
  );
  if (!liste) {
    return null;
  }

  return (
    categories.find(
      (categorie) =>
        normaliserTexte(categorie.nom) === normaliserTexte(liste),
    )?.id ?? null
  );
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

function construirePrompt(params: ProposerDocumentParams): string {
  const categoriesListe = params.categories
    .map((categorie) => `- ${categorie.nom} (id: ${categorie.id})`)
    .join("\n");

  const majeursListe = params.majeurs
    .map((majeur) => `- ${majeur.nom} ${majeur.prenom} (id: ${majeur.id})`)
    .join("\n");

  return `Tu es un assistant de classement documentaire pour un logiciel MJPM en France.

Analyse le document joint et le nom du fichier, puis propose :
1. La catégorie la plus adaptée parmi la liste
2. Le protégé (majeur) le plus probable parmi la liste
3. Un nom de fichier court, clair et descriptif (avec extension)

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"categorie":"Nom catégorie exacte","majeur_id":"uuid du protégé","nom_fichier":"nom_suggere.pdf"}

Si tu ne peux pas déterminer une valeur, mets null pour ce champ.

Catégories disponibles :
${categoriesListe}

Protégés actifs :
${majeursListe}

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

function parserReponseJson(texte: string): {
  categorie?: string | null;
  majeur_id?: string | null;
  nom_fichier?: string | null;
} | null {
  try {
    return JSON.parse(texte) as {
      categorie?: string | null;
      majeur_id?: string | null;
      nom_fichier?: string | null;
    };
  } catch {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    if (debut === -1 || fin === -1) {
      return null;
    }

    try {
      return JSON.parse(texte.slice(debut, fin + 1)) as {
        categorie?: string | null;
        majeur_id?: string | null;
        nom_fichier?: string | null;
      };
    } catch {
      return null;
    }
  }
}

export async function proposerDocumentNonClasse(
  params: ProposerDocumentParams,
): Promise<PropositionDocumentIA> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("[proposerDocumentNonClasse] ANTHROPIC_API_KEY manquante");
    return { categorieId: null, majeurId: null, nomFichier: null };
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
        max_tokens: 256,
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
      return { categorieId: null, majeurId: null, nomFichier: null };
    }

    const result = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const texte =
      result.content.find((bloc) => bloc.type === "text")?.text?.trim() ?? "";
    const json = parserReponseJson(texte);

    if (!json) {
      return { categorieId: null, majeurId: null, nomFichier: null };
    }

    const categorieId =
      json.categorie && json.categorie !== "null"
        ? resoudreCategorieId(json.categorie, params.categories)
        : null;

    const majeurId =
      json.majeur_id && json.majeur_id !== "null"
        ? resoudreMajeurId(json.majeur_id, params.majeurs)
        : null;

    const nomFichier =
      json.nom_fichier && json.nom_fichier !== "null"
        ? json.nom_fichier.trim()
        : null;

    return { categorieId, majeurId, nomFichier };
  } catch (error) {
    console.error("[proposerDocumentNonClasse] Erreur:", error);
    return { categorieId: null, majeurId: null, nomFichier: null };
  }
}
