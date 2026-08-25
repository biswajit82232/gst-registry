import Papa from "papaparse";
import { calcGst, gstinCheckDigit, humanNotes, isValidGstin, toNumber } from "./gst";
import { parseInputStatus } from "./input";
import type { Purchase, PurchaseInput, TaxType } from "./types";

export const CSV_COLUMNS = [
  "invoice_date",
  "invoice_number",
  "supplier_name",
  "supplier_gstin",
  "purchased_by",
  "category",
  "hsn_sac",
  "taxable_value",
  "gst_rate",
  "tax_type",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "invoice_total",
  "itc_eligible",
  "reverse_charge",
  "payment_status",
  "payment_date",
  "place_of_supply",
  "notes",
  "input_status",
] as const;

const ALIASES: Record<string, string> = {
  date: "invoice_date",
  invoice: "invoice_number",
  "invoice no": "invoice_number",
  "invoice number": "invoice_number",
  supplier: "supplier_name",
  "vendor name": "supplier_name",
  purchaser: "purchased_by",
  "purchaser name": "purchased_by",
  gstin: "supplier_gstin",
  "gst no": "supplier_gstin",
  taxable: "taxable_value",
  amount: "taxable_value",
  value: "taxable_value",
  rate: "gst_rate",
  "gst %": "gst_rate",
  type: "tax_type",
  itc: "itc_eligible",
  rcm: "reverse_charge",
  payment: "payment_status",
  hsn: "hsn_sac",
  sac: "hsn_sac",
  remark: "notes",
  remarks: "notes",
  "got input": "input_status",
  input: "input_status",
};

function keyOf(header: string): string {
  const raw = header.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (ALIASES[raw]) return ALIASES[raw];
  return raw.replace(/\s+/g, "_");
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  return ["1", "true", "yes", "y", "eligible"].includes(s);
}

function parseDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${m}-${d}`;
  }
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  return "";
}

export function purchasesToCsv(rows: Purchase[]): string {
  const data = rows.map((row) => ({
    invoice_date: row.invoice_date,
    invoice_number: row.invoice_number,
    supplier_name: row.supplier_name,
    supplier_gstin: row.supplier_gstin ?? "",
    purchased_by: row.purchased_by ?? "",
    category: row.category,
    hsn_sac: row.hsn_sac ?? "",
    taxable_value: row.taxable_value,
    gst_rate: row.gst_rate,
    tax_type: row.tax_type,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    cess: row.cess,
    invoice_total: row.invoice_total,
    itc_eligible: row.itc_eligible ? "yes" : "no",
    reverse_charge: row.reverse_charge ? "yes" : "no",
    payment_status: row.payment_status,
    payment_date: row.payment_date ?? "",
    place_of_supply: row.place_of_supply ?? "",
    notes: humanNotes(row.notes) ?? "",
    input_status: row.input_status,
  }));
  return Papa.unparse(data, { columns: [...CSV_COLUMNS] });
}

export function csvTemplate(): string {
  return Papa.unparse(
    [
      {
        invoice_date: "2026-08-01",
        invoice_number: "INV-101",
        supplier_name: "Acme Traders",
        supplier_gstin: `27AAAAA0000A1Z${gstinCheckDigit("27AAAAA0000A1Z")}`,
        purchased_by: "Self",
        category: "goods",
        hsn_sac: "8471",
        taxable_value: 10000,
        gst_rate: 18,
        tax_type: "intra",
        cgst: 900,
        sgst: 900,
        igst: 0,
        cess: 0,
        invoice_total: 11800,
        itc_eligible: "yes",
        reverse_charge: "no",
        payment_status: "paid",
        payment_date: "2026-08-01",
        place_of_supply: "Maharashtra",
        notes: "",
        input_status: "waiting",
      },
    ],
    { columns: [...CSV_COLUMNS] },
  );
}

export function parsePurchaseCsv(text: string): {
  rows: PurchaseInput[];
  errors: string[];
} {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: keyOf,
  });

  const errors: string[] = [...(parsed.errors.map((e) => e.message) ?? [])];
  const rows: PurchaseInput[] = [];

  parsed.data.forEach((raw, i) => {
    const line = i + 2;
    const supplier_name = String(raw.supplier_name ?? "").trim();
    const invoice_number = String(raw.invoice_number ?? "").trim();
    const invoice_date = parseDate(raw.invoice_date);
    if (!supplier_name || !invoice_number || !invoice_date) {
      errors.push(`Row ${line}: date, invoice number and supplier are required.`);
      return;
    }

    const gstin = String(raw.supplier_gstin ?? "").trim().toUpperCase();
    if (gstin && !isValidGstin(gstin)) {
      errors.push(`Row ${line}: GSTIN "${gstin}" looks invalid (saved anyway).`);
    }

    const taxType: TaxType = String(raw.tax_type ?? "").toLowerCase().includes("inter")
      ? "inter"
      : "intra";
    const taxable = toNumber(raw.taxable_value);
    const rate = raw.gst_rate === undefined || raw.gst_rate === "" ? 18 : toNumber(raw.gst_rate);
    const computed = calcGst({
      taxableValue: taxable,
      gstRate: rate,
      taxType,
      cess: toNumber(raw.cess),
    });

    const hasTax =
      raw.cgst !== undefined || raw.sgst !== undefined || raw.igst !== undefined;

    rows.push({
      invoice_date,
      invoice_number,
      supplier_name,
      supplier_gstin: gstin || "",
      purchased_by: String(raw.purchased_by ?? "").trim(),
      category:
        raw.category === "services" || raw.category === "capital"
          ? raw.category
          : "goods",
      hsn_sac: String(raw.hsn_sac ?? "").trim(),
      gst_rate: rate,
      tax_type: taxType,
      cgst: hasTax && raw.cgst !== "" ? toNumber(raw.cgst) : computed.cgst,
      sgst: hasTax && raw.sgst !== "" ? toNumber(raw.sgst) : computed.sgst,
      igst: hasTax && raw.igst !== "" ? toNumber(raw.igst) : computed.igst,
      cess: computed.cess,
      taxable_value: taxable,
      invoice_total:
        raw.invoice_total !== undefined && raw.invoice_total !== ""
          ? toNumber(raw.invoice_total)
          : computed.invoice_total,
      itc_eligible: bool(raw.itc_eligible, true),
      reverse_charge: bool(raw.reverse_charge, false),
      payment_status: String(raw.payment_status ?? "").toLowerCase() === "unpaid" ? "unpaid" : "paid",
      payment_date: parseDate(raw.payment_date) || invoice_date,
      place_of_supply: String(raw.place_of_supply ?? "").trim(),
      notes: humanNotes(String(raw.notes ?? "").trim()) ?? "",
      lines: [
        {
          taxable,
          rate,
          gst: (hasTax && raw.cgst !== "" ? toNumber(raw.cgst) : computed.cgst)
            + (hasTax && raw.sgst !== "" ? toNumber(raw.sgst) : computed.sgst)
            + (hasTax && raw.igst !== "" ? toNumber(raw.igst) : computed.igst),
        },
      ],
      supplier_id: null,
      input_status: parseInputStatus(raw.input_status),
      input_on: null,
    });
  });

  return { rows, errors };
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
