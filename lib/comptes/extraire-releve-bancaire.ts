import { CLAUDE_MODEL_SONNET } from "@/lib/claude/models";

export interface TransactionReleveExtraite {
  date: string;
  libelle: string;
  /** Montant absolu (toujours positif). */
  montant: number;
  sens: "debit" | "credit";
}

export interface ReleveBancaireExtrait {
  banque: string | null;
  numeroCompte: string | null;
  iban: string | null;
  soldeDebut: number | null;
  soldeFin: number | null;
  /** Première date couverte par le relevé (YYYY-MM-DD). */
  periodeDebut: string | null;
  /** Dernière date couverte par le relevé (YYYY-MM-DD). */
  periodeFin: string | null;
  transactions: TransactionReleveExtraite[];
  lignesRejetees: number;
  coherenceValidee: boolean;
  qualiteLisible: boolean;
  zonesIncertaines: string[];
}

interface LigneTransactionClaude {
  date?: string;
  libelle?: string;
  montant?: number | string;
  sens?: string;
}

interface ReponseClaudeReleve {
  banque?: string | null;
  numero_compte?: string | null;
  iban?: string | null;
  solde_debut?: number | string | null;
  solde_fin?: number | string | null;
  periode_debut?: string | null;
  periode_fin?: string | null;
  transactions?: LigneTransactionClaude[];
  coherence_validee?: boolean;
  qualite_lisible?: boolean;
  zones_incertaines?: string[];
}

function parserReponseJson(texte: string): ReponseClaudeReleve | null {
  try {
    return JSON.parse(texte) as ReponseClaudeReleve;
  } catch {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    if (debut === -1 || fin === -1) {
      return null;
    }

    try {
      return JSON.parse(texte.slice(debut, fin + 1)) as ReponseClaudeReleve;
    } catch {
      return null;
    }
  }
}

function normaliserDate(valeur: string | undefined): string | null {
  if (!valeur) {
    return null;
  }

  const trimme = valeur.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimme)) {
    return trimme;
  }

  const matchFr = trimme.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!matchFr) {
    return null;
  }

  const jour = matchFr[1].padStart(2, "0");
  const mois = matchFr[2].padStart(2, "0");
  let annee = matchFr[3];
  if (annee.length === 2) {
    annee = Number(annee) >= 70 ? `19${annee}` : `20${annee}`;
  }

  return `${annee}-${mois}-${jour}`;
}

function normaliserSens(valeur: string | undefined): "debit" | "credit" | null {
  if (!valeur) {
    return null;
  }

  const normalise = valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["debit", "depense", "sortie", "d"].includes(normalise)) {
    return "debit";
  }

  if (["credit", "revenu", "entree", "c"].includes(normalise)) {
    return "credit";
  }

  return null;
}

function normaliserMontant(valeur: number | string | undefined): number | null {
  if (typeof valeur === "number") {
    if (!Number.isFinite(valeur)) {
      return null;
    }

    return Math.round(Math.abs(valeur) * 100) / 100;
  }

  if (typeof valeur !== "string") {
    return null;
  }

  // "1 234,56" / "12,34" / "12.34" → nombre
  const nettoye = valeur
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!nettoye) {
    return null;
  }

  const parse = Number(nettoye);
  if (!Number.isFinite(parse)) {
    return null;
  }

  return Math.round(Math.abs(parse) * 100) / 100;
}

/** Solde bancaire (peut être négatif) — même parsing que normaliserMontant, signe conservé. */
function normaliserSolde(
  valeur: number | string | null | undefined
): number | null {
  if (valeur === null || valeur === undefined) {
    return null;
  }

  if (typeof valeur === "number") {
    if (!Number.isFinite(valeur)) {
      return null;
    }

    return Math.round(valeur * 100) / 100;
  }

  if (typeof valeur !== "string") {
    return null;
  }

  const nettoye = valeur
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!nettoye) {
    return null;
  }

  const parse = Number(nettoye);
  if (!Number.isFinite(parse)) {
    return null;
  }

  return Math.round(parse * 100) / 100;
}

function construirePrompt(): string {
  return `Tu es un expert en extraction de relevés bancaires français pour un logiciel MJPM.

Analyse le PDF de relevé bancaire joint et extrais toutes les opérations visibles.

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "banque": "nom de la banque ou null",
  "numero_compte": "numéro de compte (sans espaces) ou null",
  "iban": "IBAN ou null",
  "solde_debut": nombre ou null,
  "solde_fin": nombre ou null,
  "periode_debut": "YYYY-MM-DD ou null",
  "periode_fin": "YYYY-MM-DD ou null",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "libelle": "libellé de l'opération",
      "montant": 12.34,
      "sens": "debit" ou "credit"
    }
  ],
  "coherence_validee": true/false,
  "qualite_lisible": true/false,
  "zones_incertaines": ["description des zones illisibles ou douteuses"]
}

Règles :
- montant est TOUJOURS positif ; le sens indique débit ou crédit
- periode_debut / periode_fin = bornes de la période du relevé (souvent indiquées en en-tête)
- Inclure toutes les opérations de la période du relevé
- coherence_validee = true seulement si solde_debut + crédits - débits ≈ solde_fin (tolérance 0,02 €), ou si les soldes sont absents et les montants semblent cohérents
- qualite_lisible = false si le PDF est flou, tronqué, ou si plusieurs lignes sont douteuses
- zones_incertaines liste précisément ce qui pose problème (ex. "ligne du 12/03 montant illisible")
- Si aucune transaction n'est lisible, renvoie transactions: [] et qualite_lisible: false`;
}

/**
 * Extrait les métadonnées et transactions d'un relevé bancaire PDF via Claude.
 */
export async function extraireReleveBancaire(
  pdfBase64: string
): Promise<ReleveBancaireExtrait> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquante.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 8192,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            { type: "text", text: construirePrompt() },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur API Claude (${response.status}).`);
  }

  const result = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  const texte =
    result.content.find((bloc) => bloc.type === "text")?.text?.trim() ?? "";
  const json = parserReponseJson(texte);

  if (!json) {
    throw new Error("Réponse d'extraction de relevé illisible.");
  }

  const transactions: TransactionReleveExtraite[] = [];
  let lignesRejetees = 0;

  for (const ligne of json.transactions ?? []) {
    const date = normaliserDate(
      typeof ligne.date === "string" ? ligne.date : undefined
    );
    const sens = normaliserSens(
      typeof ligne.sens === "string" ? ligne.sens : undefined
    );
    const montant = normaliserMontant(ligne.montant);
    const libelle =
      typeof ligne.libelle === "string" ? ligne.libelle.trim() : "";

    if (!date || !sens || montant === null || !libelle) {
      lignesRejetees += 1;
      console.warn(
        "[extraireReleveBancaire] Ligne de transaction rejetée (date/sens/montant/libelle manquant ou invalide):",
        ligne
      );
      continue;
    }

    transactions.push({ date, libelle, montant, sens });
  }

  const zonesIncertaines = Array.isArray(json.zones_incertaines)
    ? json.zones_incertaines
        .filter((zone): zone is string => typeof zone === "string")
        .map((zone) => zone.trim())
        .filter(Boolean)
    : [];

  let dateMinTransactions: string | null = null;
  let dateMaxTransactions: string | null = null;
  for (const transaction of transactions) {
    if (!dateMinTransactions || transaction.date < dateMinTransactions) {
      dateMinTransactions = transaction.date;
    }
    if (!dateMaxTransactions || transaction.date > dateMaxTransactions) {
      dateMaxTransactions = transaction.date;
    }
  }

  const periodeDebut =
    normaliserDate(
      typeof json.periode_debut === "string" ? json.periode_debut : undefined
    ) ?? dateMinTransactions;
  const periodeFin =
    normaliserDate(
      typeof json.periode_fin === "string" ? json.periode_fin : undefined
    ) ?? dateMaxTransactions;

  return {
    banque: json.banque?.trim() || null,
    numeroCompte: json.numero_compte?.replace(/\s+/g, "").trim() || null,
    iban: json.iban?.replace(/\s+/g, "").trim() || null,
    soldeDebut: normaliserSolde(json.solde_debut),
    soldeFin: normaliserSolde(json.solde_fin),
    periodeDebut,
    periodeFin,
    transactions,
    lignesRejetees,
    coherenceValidee: json.coherence_validee === true,
    qualiteLisible: json.qualite_lisible !== false,
    zonesIncertaines,
  };
}
