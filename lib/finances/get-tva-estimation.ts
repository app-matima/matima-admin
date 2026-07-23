import { getTvaMontantDejaProvisionne } from "@/lib/finances/tva-provision";

const PENNYLANE_API_BASE = "https://app.pennylane.com/api/external/v2";
const LIMITE_PAR_PAGE = 100;

export interface TvaEstimation {
  annee: number;
  dateDebut: string;
  tvaCollectee: number;
  tvaDeductible: number;
  tvaEstimee: number;
  montantDejaProvisionne: number;
  resteAProvisionner: number;
  nbFacturesClients: number;
  nbFacturesFournisseurs: number;
}

interface PennylaneInvoiceTaxRow {
  id?: number | string;
  date?: string | null;
  draft?: boolean | null;
  credit_note?: boolean | null;
  status?: string | null;
  currency_tax?: string | number | null;
  tax?: string | number | null;
}

interface PennylaneListResponse {
  items?: PennylaneInvoiceTaxRow[];
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

function parseAmount(value: string | number | null | undefined): number {
  if (value == null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getInvoiceTaxAmount(invoice: PennylaneInvoiceTaxRow): number {
  const raw = parseAmount(invoice.currency_tax ?? invoice.tax);
  const status = invoice.status?.trim().toLowerCase() ?? "";
  const isCreditNote =
    invoice.credit_note === true ||
    status === "credit_note" ||
    status === "credit_note_status" ||
    status.includes("credit_note");

  if (isCreditNote) {
    return -Math.abs(raw);
  }

  return raw;
}

function estBrouillon(invoice: PennylaneInvoiceTaxRow): boolean {
  if (invoice.draft === true) {
    return true;
  }

  const status = invoice.status?.trim().toLowerCase() ?? "";
  return status === "draft" || status === "draft_status";
}

function getDateDebutAnneeEnCours(reference = new Date()): {
  annee: number;
  dateDebut: string;
} {
  const annee = reference.getFullYear();
  return {
    annee,
    dateDebut: `${annee}-01-01`,
  };
}

async function fetchInvoicesPage(
  endpoint: "customer_invoices" | "supplier_invoices",
  token: string,
  params: URLSearchParams,
): Promise<PennylaneListResponse> {
  const response = await fetch(
    `${PENNYLANE_API_BASE}/${endpoint}?${params.toString()}`,
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
      `Pennylane API error (${response.status}) ${endpoint}: ${body || response.statusText}`,
    );
  }

  return (await response.json()) as PennylaneListResponse;
}

async function listerFacturesDepuis(
  endpoint: "customer_invoices" | "supplier_invoices",
  dateDebut: string,
): Promise<PennylaneInvoiceTaxRow[]> {
  const token = getPennylaneApiToken();
  const filter = JSON.stringify([
    { field: "date", operator: "gteq", value: dateDebut },
  ]);

  const invoices: PennylaneInvoiceTaxRow[] = [];
  let cursor: string | null = null;

  for (;;) {
    const params = new URLSearchParams();
    params.set("limit", String(LIMITE_PAR_PAGE));
    params.set("sort", "date");
    params.set("filter", filter);

    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = await fetchInvoicesPage(endpoint, token, params);
    invoices.push(...(payload.items ?? []));

    if (!payload.has_more || !payload.next_cursor) {
      break;
    }

    cursor = payload.next_cursor;
  }

  return invoices;
}

function sommerTva(invoices: PennylaneInvoiceTaxRow[]): {
  total: number;
  count: number;
} {
  let total = 0;
  let count = 0;

  for (const invoice of invoices) {
    if (estBrouillon(invoice)) {
      continue;
    }

    total += getInvoiceTaxAmount(invoice);
    count += 1;
  }

  return {
    total: Math.round(total * 100) / 100,
    count,
  };
}

export async function getTvaEstimationAnneeEnCours(): Promise<TvaEstimation> {
  const { annee, dateDebut } = getDateDebutAnneeEnCours();

  const [facturesClients, facturesFournisseurs, montantDejaProvisionne] =
    await Promise.all([
      listerFacturesDepuis("customer_invoices", dateDebut),
      listerFacturesDepuis("supplier_invoices", dateDebut),
      getTvaMontantDejaProvisionne(),
    ]);

  const collectee = sommerTva(facturesClients);
  const deductible = sommerTva(facturesFournisseurs);
  const tvaEstimee =
    Math.round((collectee.total - deductible.total) * 100) / 100;
  const resteAProvisionner =
    Math.round((tvaEstimee - montantDejaProvisionne) * 100) / 100;

  return {
    annee,
    dateDebut,
    tvaCollectee: collectee.total,
    tvaDeductible: deductible.total,
    tvaEstimee,
    montantDejaProvisionne,
    resteAProvisionner,
    nbFacturesClients: collectee.count,
    nbFacturesFournisseurs: deductible.count,
  };
}
