import type { StatutFacturation } from "@/types";

const PENNYLANE_API_BASE = "https://app.pennylane.com/api/external/v2";

const FENETRE_DATE_JOURS = 21;
const TOLERANCE_MONTANT = 0.05;
const LIMITE_PAR_PAGE = 100;
const MAX_PAGES = 3;
const MAX_SUGGESTIONS = 8;

export type PennylaneStatutFacture =
  | "payee"
  | "impayee"
  | "partiellement_payee";

export function mapPennylaneToStatutFacturation(
  statut: PennylaneStatutFacture,
): StatutFacturation {
  switch (statut) {
    case "payee":
      return "payee";
    case "partiellement_payee":
      return "partiellement_payee";
    case "impayee":
      return "facture_envoyee";
    default:
      return "facture_envoyee";
  }
}

export interface FacturePennylaneSuggestion {
  id: string;
  invoiceNumber: string;
  montant: number | null;
  date: string | null;
  nomClient: string;
}

interface PennylaneCustomerInvoice {
  id?: number | string;
  invoice_number?: string | null;
  status?: string | null;
  paid?: boolean | null;
  draft?: boolean | null;
  credit_note?: boolean | null;
  date?: string | null;
  remaining_amount_with_tax?: string | number | null;
  currency_amount?: string | number | null;
  amount?: string | number | null;
  customer_name?: string | null;
  customer?:
    | string
    | {
        id?: number | string;
        url?: string | null;
        name?: string | null;
        company_name?: string | null;
      }
    | null;
}

interface PennylaneCustomer {
  id?: number | string;
  name?: string | null;
  company_name?: string | null;
  legal_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface PennylaneListResponse {
  items?: PennylaneCustomerInvoice[];
  has_more?: boolean;
  next_cursor?: string | null;
}

function getPennylaneApiToken(): string {
  const token = process.env.PENNYLANE_API_TOKEN;

  if (!token) {
    throw new Error("Configuration Pennylane manquante (PENNYLANE_API_TOKEN).");
  }

  return token;
}

function parseAmount(value: string | number | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapInvoiceToStatut(
  invoice: PennylaneCustomerInvoice,
): PennylaneStatutFacture {
  const status = invoice.status?.trim().toLowerCase() ?? "";

  if (
    status === "paid" ||
    status === "paid_status" ||
    invoice.paid === true
  ) {
    return "payee";
  }

  if (
    status === "partially_paid" ||
    status === "partially_paid_status"
  ) {
    return "partiellement_payee";
  }

  const remaining = parseAmount(invoice.remaining_amount_with_tax);
  const total =
    parseAmount(invoice.currency_amount) ?? parseAmount(invoice.amount);

  if (remaining != null && remaining <= 0) {
    return "payee";
  }

  if (
    remaining != null &&
    total != null &&
    remaining > 0 &&
    remaining < total
  ) {
    return "partiellement_payee";
  }

  return "impayee";
}

function estAvoir(invoice: PennylaneCustomerInvoice): boolean {
  if (invoice.credit_note === true) {
    return true;
  }

  const status = invoice.status?.trim().toLowerCase() ?? "";
  return (
    status === "credit_note" ||
    status === "credit_note_status" ||
    status.includes("credit_note")
  );
}

function estBrouillon(invoice: PennylaneCustomerInvoice): boolean {
  if (invoice.draft === true) {
    return true;
  }

  const status = invoice.status?.trim().toLowerCase() ?? "";
  return status === "draft" || status === "draft_status";
}

function getInvoiceCustomerId(
  invoice: PennylaneCustomerInvoice,
): string | null {
  if (invoice.customer && typeof invoice.customer === "object") {
    if (invoice.customer.id != null) {
      return String(invoice.customer.id);
    }
  }

  return null;
}

function extractCustomerDisplayName(customer: PennylaneCustomer): string {
  const candidates = [
    customer.name,
    customer.company_name,
    customer.legal_name,
    customer.first_name && customer.last_name
      ? `${customer.first_name} ${customer.last_name}`
      : null,
    customer.first_name,
    customer.last_name,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

async function fetchCustomerName(
  token: string,
  customerId: string,
  cache: Map<string, string>,
): Promise<string> {
  if (cache.has(customerId)) {
    return cache.get(customerId) ?? "";
  }

  const response = await fetch(
    `${PENNYLANE_API_BASE}/customers/${encodeURIComponent(customerId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `Pennylane API error (${response.status}) customer ${customerId}: ${body || response.statusText}`,
    );
    cache.set(customerId, "");
    return "";
  }

  const customer = (await response.json()) as PennylaneCustomer;
  const nom = extractCustomerDisplayName(customer);
  cache.set(customerId, nom);
  return nom;
}

async function resolveInvoiceCustomerName(
  token: string,
  invoice: PennylaneCustomerInvoice,
  cache: Map<string, string>,
): Promise<string> {
  const customerId = getInvoiceCustomerId(invoice);

  if (customerId) {
    return fetchCustomerName(token, customerId, cache);
  }

  if (typeof invoice.customer === "string" && invoice.customer.trim()) {
    return invoice.customer.trim();
  }

  return invoice.customer_name?.trim() || "";
}

function getInvoiceAmount(invoice: PennylaneCustomerInvoice): number | null {
  return (
    parseAmount(invoice.currency_amount) ?? parseAmount(invoice.amount)
  );
}

function normaliserTexte(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nomsProches(nomA: string, nomB: string): boolean {
  const a = normaliserTexte(nomA);
  const b = normaliserTexte(nomB);

  if (!a || !b) {
    return false;
  }

  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }

  const tokensA = a.split(" ").filter((token) => token.length >= 3);
  const tokensB = new Set(b.split(" ").filter((token) => token.length >= 3));

  if (tokensA.length === 0 || tokensB.size === 0) {
    return false;
  }

  const communs = tokensA.filter((token) => tokensB.has(token)).length;
  const seuil = Math.min(tokensA.length, tokensB.size) >= 2 ? 2 : 1;
  return communs >= seuil;
}

function montantsProches(
  montantFacture: number | null,
  montantApprox: number | null,
): boolean {
  if (montantApprox == null || !Number.isFinite(montantApprox)) {
    return true;
  }

  if (montantFacture == null) {
    return false;
  }

  const delta = Math.abs(montantFacture - montantApprox);
  return delta <= Math.abs(montantApprox) * TOLERANCE_MONTANT;
}

function parseDateApprox(dateApprox: string): Date | null {
  const trimmed = dateApprox.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ajouterJours(date: Date, jours: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + jours);
  return next;
}

function dateDansFenetre(
  dateFacture: string | null | undefined,
  dateApprox: Date,
): boolean {
  if (!dateFacture) {
    return false;
  }

  const parsed = parseDateApprox(dateFacture);
  if (!parsed) {
    return false;
  }

  const min = ajouterJours(dateApprox, -FENETRE_DATE_JOURS).getTime();
  const max = ajouterJours(dateApprox, FENETRE_DATE_JOURS).getTime();
  const time = parsed.getTime();
  return time >= min && time <= max;
}

async function fetchCustomerInvoicesPage(
  token: string,
  params: URLSearchParams,
): Promise<PennylaneListResponse> {
  const response = await fetch(
    `${PENNYLANE_API_BASE}/customer_invoices?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Pennylane API error (${response.status}) list customer_invoices: ${body || response.statusText}`,
    );
  }

  return (await response.json()) as PennylaneListResponse;
}

function toSuggestion(
  invoice: PennylaneCustomerInvoice,
  nomClient: string,
): FacturePennylaneSuggestion | null {
  if (invoice.id == null) {
    return null;
  }

  const id = String(invoice.id);
  const invoiceNumber = invoice.invoice_number?.trim() || id;

  return {
    id,
    invoiceNumber,
    montant: getInvoiceAmount(invoice),
    date: invoice.date ?? null,
    nomClient: nomClient || "Client inconnu",
  };
}

/**
 * Récupère le statut de paiement d'une facture client Pennylane.
 * `factureId` peut être l'ID numérique Pennylane.
 */
export async function getStatutFactureClient(
  factureId: string,
): Promise<PennylaneStatutFacture> {
  const trimmedId = factureId.trim();

  if (!trimmedId) {
    throw new Error("Identifiant de facture Pennylane manquant.");
  }

  const token = getPennylaneApiToken();
  const response = await fetch(
    `${PENNYLANE_API_BASE}/customer_invoices/${encodeURIComponent(trimmedId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Pennylane API error (${response.status}) pour facture ${trimmedId}: ${body || response.statusText}`,
    );
  }

  const invoice = (await response.json()) as PennylaneCustomerInvoice;
  return mapInvoiceToStatut(invoice);
}

/**
 * Cherche des factures Pennylane susceptibles de correspondre à une prestation.
 * Filtre par date côté API quand possible, puis nom (insensible casse/accents)
 * et montant (±5%) côté serveur.
 */
export async function rechercherFacturesCorrespondantes(
  nomClient: string,
  montantApprox: number | null,
  dateApprox: string,
): Promise<FacturePennylaneSuggestion[]> {
  const nomRecherche = nomClient.trim();
  const dateRef = parseDateApprox(dateApprox);

  if (!nomRecherche || !dateRef) {
    return [];
  }

  const token = getPennylaneApiToken();
  const dateMin = formatDateIso(ajouterJours(dateRef, -FENETRE_DATE_JOURS));
  const dateMax = formatDateIso(ajouterJours(dateRef, FENETRE_DATE_JOURS));

  const filterAvecDates = JSON.stringify([
    { field: "date", operator: "gteq", value: dateMin },
    { field: "date", operator: "lteq", value: dateMax },
  ]);

  let invoices: PennylaneCustomerInvoice[] = [];
  let cursor: string | null = null;
  let utiliseFiltreDates = true;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams();
    params.set("limit", String(LIMITE_PAR_PAGE));
    params.set("sort", "-date");

    if (utiliseFiltreDates) {
      params.set("filter", filterAvecDates);
    }

    if (cursor) {
      params.set("cursor", cursor);
    }

    let payload: PennylaneListResponse;

    try {
      payload = await fetchCustomerInvoicesPage(token, params);
    } catch (error) {
      if (utiliseFiltreDates && page === 0) {
        utiliseFiltreDates = false;
        cursor = null;
        page -= 1;
        continue;
      }
      throw error;
    }

    invoices = invoices.concat(payload.items ?? []);

    if (!payload.has_more || !payload.next_cursor) {
      break;
    }

    cursor = payload.next_cursor;
  }

  const candidates = invoices.filter((invoice) => {
    if (estBrouillon(invoice) || estAvoir(invoice)) {
      return false;
    }

    return dateDansFenetre(invoice.date, dateRef);
  });

  console.log("[Pennylane matching] nomRecherche:", nomRecherche);
  console.log(
    "[Pennylane matching] candidates dans fenêtre de dates:",
    candidates.length,
  );

  const customerNameCache = new Map<string, string>();
  const suggestions: FacturePennylaneSuggestion[] = [];

  for (const invoice of candidates) {
    const nomFacture = await resolveInvoiceCustomerName(
      token,
      invoice,
      customerNameCache,
    );
    const matchNom = nomsProches(nomRecherche, nomFacture);

    console.log("[Pennylane matching] facture candidate:", {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      nomClientResolu: nomFacture,
      nomsProches: matchNom,
    });

    if (suggestions.length >= MAX_SUGGESTIONS) {
      continue;
    }

    if (!montantsProches(getInvoiceAmount(invoice), montantApprox)) {
      continue;
    }

    if (!matchNom) {
      continue;
    }

    const suggestion = toSuggestion(invoice, nomFacture);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}
