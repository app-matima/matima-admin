import { CLAUDE_MODEL_HAIKU, CLAUDE_MODEL_SONNET } from "@/lib/claude/models";
import type { TypeTransaction } from "@/types";

interface CategoriePourProposition {
  id: string;
  nom: string;
  type: TypeTransaction;
}

interface ProposerCategorieTransactionParams {
  libelleBrut: string;
  type: TypeTransaction;
  categories: CategoriePourProposition[];
}

export interface PropositionCategorieResult {
  categorieId?: string;
  nouveauNomCategorie?: string;
}

interface ReponseClaudeCategorie {
  categorie_id?: string | null;
  nouveau_nom_categorie?: string | null;
}

interface BlocContenuClaude {
  type: string;
  text?: string;
  name?: string;
}

interface ReponseMessagesClaude {
  content: BlocContenuClaude[];
  stop_reason?: string | null;
}

const OUTIL_RECHERCHE_WEB = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 2,
} as const;

function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resoudreCategorieId(
  valeur: string,
  categories: CategoriePourProposition[],
  type: TypeTransaction
): string | null {
  const categoriesFiltrees = categories.filter(
    (categorie) => categorie.type === type
  );

  const parId = categoriesFiltrees.find((categorie) => categorie.id === valeur);
  if (parId) {
    return parId.id;
  }

  const nomNormalise = normaliserTexte(valeur);
  const parNom = categoriesFiltrees.find(
    (categorie) => normaliserTexte(categorie.nom) === nomNormalise
  );

  return parNom?.id ?? null;
}

function construirePrompt(
  params: ProposerCategorieTransactionParams,
  options: { avecRechercheWeb: boolean }
): string {
  const categoriesTexte = params.categories
    .filter((categorie) => categorie.type === params.type)
    .map((categorie) => `- ${categorie.nom} (id: ${categorie.id})`)
    .join("\n");

  const listeCategories =
    categoriesTexte.length > 0
      ? categoriesTexte
      : "(aucune catégorie existante pour ce type)";

  const consigneRecherche = options.avecRechercheWeb
    ? "- Utilise la recherche web uniquement si le nom du commerce est ambigu sur sa nature réelle.\n"
    : "";

  return `Tu es un assistant de comptabilité pour un logiciel de tutelle (MJPM) en France. Catégorise cette opération bancaire de type "${params.type}".

Libellé brut : "${params.libelleBrut}"

RÈGLE FONDAMENTALE : n'utilise une catégorie SPÉCIFIQUE que si le libellé y correspond CLAIREMENT. En cas de doute ou de libellé générique/ambigu (ex: "VIR", "VIREMENT" sans organisme identifiable), utilise TOUJOURS "Autres revenus" ou "Autres dépenses" plutôt que de forcer une catégorie précise par approximation.

CRITÈRES PAR CATÉGORIE (revenus) :
- Pension de retraite : CARSAT, CNAV, AGIRC-ARRCO, caisse de retraite explicitement nommée
- AAH : libellé mentionne explicitement "AAH"
- APA : libellé mentionne explicitement "APA" ou "Conseil départemental" + autonomie
- ASH : libellé mentionne explicitement "ASH" ou "aide sociale hébergement"
- Rente : rente viagère ou d'invalidité explicite, pas une pension de retraite classique
- Indemnités journalières : CPAM avec mention "IJ" ou "indemnités journalières", pas un remboursement de soins classique
- Remboursement sécurité sociale : CPAM ou MSA pour remboursement de SOINS (pas IJ, pas allocations)
- Allocations familiales : UNIQUEMENT si le libellé mentionne explicitement "CAF", "ALLOC FAM", "PRESTATIONS FAMILIALES" — jamais par défaut pour un virement social générique
- Revenus fonciers : loyer perçu, mention "loyer" ou nom de locataire
- Intérêts bancaires : mention "intérêts", "livret"
- Aide sociale : aide sociale générale explicite du département/CCAS, non couverte par APA/ASH
- Don familial : virement d'un nom de famille identifiable (pas un organisme)
- Vente de biens : mention vente, Leboncoin, ou équivalent
- Autres revenus : PAR DÉFAUT si rien ci-dessus ne correspond clairement, y compris virements génériques SANS organisme identifiable et remboursements de MUTUELLE (sauf si tu identifies clairement le nom de la mutuelle, auquel cas propose une nouvelle catégorie "Remboursement mutuelle")

CRITÈRES PAR CATÉGORIE (dépenses) :
- Loyer / charges : bailleur, syndic, quittance
- Énergie : EDF, ENGIE, TotalEnergies, ou fournisseur électricité/gaz identifiable
- Téléphone / internet : Orange, SFR, Bouygues, Free
- Alimentation : supermarchés identifiables (Carrefour, Leclerc, Auchan, Intermarché, Lidl, Monoprix...)
- Santé / pharmacie : pharmacie, médecin, dentiste (paiement direct, pas remboursement)
- Transport : SNCF, RATP, stations-service, transport en commun
- Habillage : enseignes de vêtements identifiables
- Loisirs / culture : cinéma, livres, abonnements streaming
- Frais bancaires : agios, frais de tenue de compte, cotisation carte, nom de banque + "frais"
- Assurances : Matmut, MAAF, MAIF, AXA, Groupama, ou mention "assurance"
- Impôts et taxes : DGFIP, Trésor Public, impôts
- Hébergement / EHPAD : nom d'établissement + frais de séjour
- Argent de vie : retrait espèces, DAB
- Autres dépenses : PAR DÉFAUT si rien ci-dessus ne correspond clairement

Catégories existantes de ce type disponibles :
${listeCategories}

Consignes finales :
- Utilise en priorité une catégorie EXISTANTE si elle correspond clairement selon les critères ci-dessus (utilise son id exact).
- Si le libellé est ambigu et ne correspond CLAIREMENT à aucun critère, réponds "Autres revenus" / "Autres dépenses" plutôt que de deviner.
- Si un commerce identifiable ne rentre dans aucune catégorie existante, propose un nom précis de nouvelle catégorie.
${consigneRecherche}- Utilise UN SEUL des deux champs : soit categorie_id, soit nouveau_nom_categorie (l'autre doit être null).

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"categorie_id":"<uuid exact d'une catégorie listée ou null>","nouveau_nom_categorie":"<nom court ou null>"}`;
}

function parserReponseJson(texte: string): ReponseClaudeCategorie | null {
  try {
    return JSON.parse(texte) as ReponseClaudeCategorie;
  } catch {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    if (debut === -1 || fin === -1) {
      return null;
    }

    try {
      return JSON.parse(texte.slice(debut, fin + 1)) as ReponseClaudeCategorie;
    } catch {
      return null;
    }
  }
}

function interpreterReponseClaude(
  json: ReponseClaudeCategorie,
  categories: CategoriePourProposition[],
  type: TypeTransaction
): PropositionCategorieResult | null {
  const categorieIdBrut = json.categorie_id?.trim();
  if (categorieIdBrut && categorieIdBrut !== "null") {
    const categorieId = resoudreCategorieId(
      categorieIdBrut,
      categories,
      type
    );
    if (categorieId) {
      return { categorieId };
    }
  }

  const nouveauNom = json.nouveau_nom_categorie?.trim();
  if (nouveauNom && nouveauNom !== "null") {
    return { nouveauNomCategorie: nouveauNom };
  }

  return null;
}

/** Détecte si Claude a déclenché web_search dans cette réponse (exécuté côté serveur). */
function aUtiliseRechercheWeb(content: BlocContenuClaude[]): boolean {
  return content.some(
    (bloc) =>
      bloc.type === "web_search_tool_result" ||
      (bloc.type === "server_tool_use" && bloc.name === "web_search")
  );
}

/**
 * Après usage éventuel de web_search (multi-tours gérés nativement par l'API),
 * le JSON final est dans le dernier bloc texte.
 */
function extraireTexteFinal(content: BlocContenuClaude[]): string {
  const textes = content
    .filter((bloc) => bloc.type === "text" && typeof bloc.text === "string")
    .map((bloc) => bloc.text?.trim() ?? "")
    .filter((texte) => texte.length > 0);

  if (textes.length === 0) {
    return "";
  }

  return textes[textes.length - 1] ?? "";
}

async function appelerClaudeCategorie(params: {
  prompt: string;
  model: string;
  avecRechercheWeb: boolean;
  libelleBrut: string;
}): Promise<ReponseMessagesClaude | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: 1024,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: params.prompt,
      },
    ],
  };

  if (params.avecRechercheWeb) {
    body.tools = [OUTIL_RECHERCHE_WEB];
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detailErreur = await response.text().catch(() => "");
    console.error(
      "[proposerCategorieTransaction] Erreur API Claude:",
      params.model,
      response.status,
      detailErreur.slice(0, 200)
    );
    return null;
  }

  const result = (await response.json()) as ReponseMessagesClaude;

  if (params.avecRechercheWeb) {
    console.log(
      "[proposerCategorieTransaction] recherche_web=",
      aUtiliseRechercheWeb(result.content ?? []),
      "libelle=",
      params.libelleBrut.slice(0, 80)
    );
  }

  return result;
}

function interpreterReponseMessages(
  result: ReponseMessagesClaude,
  categories: CategoriePourProposition[],
  type: TypeTransaction
): PropositionCategorieResult | null {
  const texte = extraireTexteFinal(result.content ?? []);
  const json = parserReponseJson(texte);

  if (!json) {
    return null;
  }

  return interpreterReponseClaude(json, categories, type);
}

/**
 * Proposition à paliers : Haiku d'abord (sans web_search), puis Sonnet + web_search
 * uniquement si aucune catégorie claire ni nom de nouvelle catégorie.
 */
export async function proposerCategorieTransaction(
  params: ProposerCategorieTransactionParams
): Promise<PropositionCategorieResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !params.libelleBrut.trim()) {
    return null;
  }

  try {
    const resultHaiku = await appelerClaudeCategorie({
      prompt: construirePrompt(params, { avecRechercheWeb: false }),
      model: CLAUDE_MODEL_HAIKU,
      avecRechercheWeb: false,
      libelleBrut: params.libelleBrut,
    });

    if (resultHaiku) {
      const propositionHaiku = interpreterReponseMessages(
        resultHaiku,
        params.categories,
        params.type
      );
      if (propositionHaiku) {
        return propositionHaiku;
      }
    }

    console.log(
      "[proposerCategorieTransaction] Escalade Sonnet+web_search, libelle=",
      params.libelleBrut.slice(0, 80)
    );

    const resultSonnet = await appelerClaudeCategorie({
      prompt: construirePrompt(params, { avecRechercheWeb: true }),
      model: CLAUDE_MODEL_SONNET,
      avecRechercheWeb: true,
      libelleBrut: params.libelleBrut,
    });

    if (!resultSonnet) {
      return null;
    }

    return interpreterReponseMessages(
      resultSonnet,
      params.categories,
      params.type
    );
  } catch (error) {
    console.error(
      "[proposerCategorieTransaction] Erreur:",
      error instanceof Error ? error.message.slice(0, 120) : "erreur inconnue"
    );
    return null;
  }
}
