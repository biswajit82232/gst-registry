import type { Purchase, PurchaseInput, PurchaseTotals, TaxType } from "./types";

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const DEFAULT_GST_RATE = 5;

export function nextUnusedRate(used: Iterable<number>): number {
  const set = new Set(used);
  for (const rate of [5, 12, 18, 28, 0] as const) {
    if (![...set].some((value) => Math.abs(value - rate) < 0.001)) return rate;
  }
  return DEFAULT_GST_RATE;
}

export type BillLine = { taxable: number; rate: number };

const LINES_PREFIX = "GSTLINES:";

export function lineGst(line: BillLine): number {
  return round2((toNumber(line.taxable) * toNumber(line.rate)) / 100);
}

export function lineTotal(line: BillLine): number {
  return round2(toNumber(line.taxable) + lineGst(line));
}

function parseRate(value: unknown): number {
  if (value == null || value === "") return 18;
  const n = toNumber(value);
  return n < 0 ? 18 : n;
}

function extraNoteFrom(raw: string): string | undefined {
  if (!raw.startsWith(LINES_PREFIX)) return raw.trim() || undefined;
  try {
    const parsed = JSON.parse(raw.slice(LINES_PREFIX.length)) as { n?: unknown };
    if (parsed && !Array.isArray(parsed) && typeof parsed.n === "string" && parsed.n.trim()) {
      return parsed.n;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function encodeLines(lines: BillLine[], previousNotes?: string | null): string {
  const items = lines.map((line) => ({ a: round2(toNumber(line.taxable)), r: parseRate(line.rate) }));
  const extra = extraNoteFrom(previousNotes ?? "");
  return LINES_PREFIX + JSON.stringify(extra ? { v: 1, items, n: extra } : items);
}

export function decodeLines(purchase: {
  notes?: string | null;
  taxable_value: number;
  gst_rate: number;
  invoice_total?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
}): BillLine[] {
  const raw = purchase.notes ?? "";
  if (raw.startsWith(LINES_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(LINES_PREFIX.length)) as
        | Array<{ a?: number; r?: number }>
        | { items?: Array<{ a?: number; r?: number }> };
      const rows = Array.isArray(parsed) ? parsed : parsed.items;
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((row) => ({ taxable: toNumber(row.a), rate: parseRate(row.r) }));
      }
    } catch {
      /* fall through */
    }
  }
  const gst = toNumber(purchase.cgst) + toNumber(purchase.sgst) + toNumber(purchase.igst);
  let taxable = toNumber(purchase.taxable_value);
  if (taxable <= 0 && toNumber(purchase.invoice_total) > 0) {
    taxable = round2(Math.max(0, toNumber(purchase.invoice_total) - gst));
  }
  const stored = toNumber(purchase.gst_rate);
  const computedFromStored = round2((taxable * stored) / 100);
  let rate = stored || 18;
  if (stored > 0 && Math.abs(computedFromStored - gst) <= 0.05) {
    rate = stored;
  } else if (taxable > 0 && gst > 0) {
    rate = (gst / taxable) * 100;
  }
  return [{ taxable, rate }];
}

export function totalsFromLines(lines: BillLine[]): {
  taxable_value: number;
  gst: number;
  invoice_total: number;
  gst_rate: number;
} {
  const taxable_value = round2(lines.reduce((sum, line) => sum + toNumber(line.taxable), 0));
  const gst = round2(lines.reduce((sum, line) => sum + lineGst(line), 0));
  const main = lines.slice().sort((a, b) => toNumber(b.taxable) - toNumber(a.taxable))[0];
  const mainRate = main ? parseRate(main.rate) : 18;
  return {
    taxable_value,
    gst,
    invoice_total: round2(taxable_value + gst),
    gst_rate: mainRate,
  };
}

export function applyLinesToInput<T extends {
  taxable_value: number;
  invoice_total: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  notes: string | null;
  itc_eligible: boolean;
}>(form: T, lines: BillLine[]): T {
  const kept = lines.filter((line) => toNumber(line.taxable) > 0);
  const use = kept.length > 0 ? kept : lines;
  const totals = totalsFromLines(use);
  return {
    ...form,
    taxable_value: totals.taxable_value,
    invoice_total: totals.invoice_total,
    gst_rate: totals.gst_rate,
    cgst: 0,
    sgst: 0,
    igst: totals.gst,
    cess: 0,
    notes: encodeLines(use, form.notes),
    itc_eligible: true,
  };
}

export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isValidGstin(gstin: string): boolean {
  const v = gstin.trim().toUpperCase();
  return GSTIN_RE.test(v);
}

export function gstinState(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  return STATE_CODES[code] ?? null;
}

export function detectTaxType(
  supplierGstin: string | null | undefined,
  ownGstin: string | null | undefined,
): TaxType {
  const a = supplierGstin?.trim().slice(0, 2);
  const b = ownGstin?.trim().slice(0, 2);
  if (a && b && a !== b) return "inter";
  return "intra";
}

export function calcGst(input: {
  taxableValue: number;
  gstRate: number;
  taxType: TaxType;
  cess?: number;
}): Pick<
  PurchaseInput,
  "cgst" | "sgst" | "igst" | "cess" | "invoice_total" | "taxable_value"
> {
  const taxable = round2(toNumber(input.taxableValue));
  const rate = toNumber(input.gstRate);
  const gst = round2((taxable * rate) / 100);
  const cess = round2(toNumber(input.cess));

  if (input.taxType === "inter") {
    return {
      taxable_value: taxable,
      cgst: 0,
      sgst: 0,
      igst: gst,
      cess,
      invoice_total: round2(taxable + gst + cess),
    };
  }

  const half = round2(gst / 2);
  const other = round2(gst - half);
  return {
    taxable_value: taxable,
    cgst: half,
    sgst: other,
    igst: 0,
    cess,
    invoice_total: round2(taxable + gst + cess),
  };
}

export function fromInvoiceTotal(input: {
  invoiceTotal: number;
  gstRate: number;
  taxType: TaxType;
  cess?: number;
}): ReturnType<typeof calcGst> {
  const rate = toNumber(input.gstRate);
  const cess = round2(toNumber(input.cess));
  const factor = 1 + rate / 100;
  const taxable =
    factor <= 0 ? 0 : round2(Math.max(0, (toNumber(input.invoiceTotal) - cess) / factor));
  return calcGst({
    taxableValue: taxable,
    gstRate: rate,
    taxType: input.taxType,
    cess,
  });
}

export function emptyPurchase(ownGstin?: string | null): PurchaseInput {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tax = calcGst({ taxableValue: 0, gstRate: DEFAULT_GST_RATE, taxType: "intra" });

  return {
    invoice_date: iso,
    invoice_number: "",
    supplier_name: "",
    supplier_gstin: "",
    purchased_by: "",
    category: "goods",
    hsn_sac: "",
    gst_rate: DEFAULT_GST_RATE,
    tax_type: detectTaxType("", ownGstin),
    itc_eligible: true,
    reverse_charge: false,
    payment_status: "paid",
    payment_date: iso,
    place_of_supply: gstinState(ownGstin) ?? "",
    notes: "",
    supplier_id: null,
    input_status: "waiting",
    input_on: null,
    ...tax,
  };
}

export function totalsOf(rows: Purchase[]): PurchaseTotals {
  return rows.reduce<PurchaseTotals>(
    (acc, row) => {
      const gst = toNumber(row.cgst) + toNumber(row.sgst) + toNumber(row.igst);
      acc.count += 1;
      acc.taxable += toNumber(row.taxable_value);
      acc.cgst += toNumber(row.cgst);
      acc.sgst += toNumber(row.sgst);
      acc.igst += toNumber(row.igst);
      acc.cess += toNumber(row.cess);
      acc.gst += gst;
      acc.total += toNumber(row.invoice_total);
      if (row.itc_eligible) acc.itc += gst;
      else acc.ineligible += gst;
      if (!row.supplier_gstin?.trim()) acc.missingGstin += 1;
      if (row.payment_status === "unpaid") acc.unpaid += 1;
      if (row.input_status === "got") {
        acc.gotGst += gst;
        acc.gotCount += 1;
      } else if (row.input_status === "missing") {
        acc.missingGst += gst;
      } else {
        acc.waitingGst += gst;
        acc.waitingCount += 1;
      }
      return acc;
    },
    {
      count: 0,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      gst: 0,
      total: 0,
      itc: 0,
      ineligible: 0,
      missingGstin: 0,
      unpaid: 0,
      waitingGst: 0,
      gotGst: 0,
      missingGst: 0,
      waitingCount: 0,
      gotCount: 0,
    },
  );
}

export function normalizePurchase(row: Record<string, unknown>): Purchase {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    invoice_date: String(row.invoice_date),
    invoice_number: String(row.invoice_number ?? ""),
    supplier_name: String(row.supplier_name ?? ""),
    supplier_gstin: row.supplier_gstin ? String(row.supplier_gstin) : null,
    purchased_by: row.purchased_by ? String(row.purchased_by) : null,
    category: (row.category as Purchase["category"]) || "goods",
    hsn_sac: row.hsn_sac ? String(row.hsn_sac) : null,
    taxable_value: toNumber(row.taxable_value),
    gst_rate: toNumber(row.gst_rate),
    tax_type: row.tax_type === "inter" ? "inter" : "intra",
    cgst: toNumber(row.cgst),
    sgst: toNumber(row.sgst),
    igst: toNumber(row.igst),
    cess: toNumber(row.cess),
    invoice_total: toNumber(row.invoice_total),
    itc_eligible: row.itc_eligible !== false && row.itc_eligible !== "false",
    reverse_charge: Boolean(row.reverse_charge),
    payment_status: row.payment_status === "unpaid" ? "unpaid" : "paid",
    payment_date: row.payment_date ? String(row.payment_date) : null,
    place_of_supply: row.place_of_supply ? String(row.place_of_supply) : null,
    notes: row.notes ? String(row.notes) : null,
    supplier_id: row.supplier_id ? String(row.supplier_id) : null,
    input_status:
      row.input_status === "got" || row.input_status === "missing" ? row.input_status : "waiting",
    input_on: row.input_on ? String(row.input_on) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
