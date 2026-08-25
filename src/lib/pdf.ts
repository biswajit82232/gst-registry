import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./format";
import { decodeLines, totalsOf } from "./gst";
import { inputLabel } from "./input";
import type { Profile, Purchase } from "./types";

const INK: [number, number, number] = [26, 25, 22];
const MUTED: [number, number, number] = [107, 104, 96];
const LINE: [number, number, number] = [214, 210, 200];
const HEAD: [number, number, number] = [26, 25, 22];
const BAND: [number, number, number] = [247, 246, 243];
const FOOT: [number, number, number] = [243, 241, 234];
const MARGIN = { top: 40, left: 12, right: 12, bottom: 16 };
const PAGE_W = 297;
const INNER = PAGE_W - MARGIN.left - MARGIN.right;

type MonthBucket = { label: string; rows: Purchase[] };

function money(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function rateLabel(row: Purchase): string {
  const lines = decodeLines(row).filter((line) => line.taxable > 0);
  const use = lines.length > 0 ? lines : decodeLines(row);
  const rates = [
    ...new Set(
      use.map((line) => {
        const r = line.rate;
        return Number.isInteger(r) ? `${r}%` : `${r.toFixed(1)}%`;
      }),
    ),
  ];
  return rates.join("+") || "—";
}

function sorted(rows: Purchase[]): Purchase[] {
  return rows.slice().sort(
    (a, b) =>
      a.invoice_date.localeCompare(b.invoice_date) ||
      a.invoice_number.localeCompare(b.invoice_number) ||
      a.id.localeCompare(b.id),
  );
}

function lastY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN.top;
}

function fileStamp(label: string): string {
  return label
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

function fit(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ell = "...";
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + ell) > maxWidth) t = t.slice(0, -1);
  return t + ell;
}

function drawChrome(
  doc: jsPDF,
  opts: {
    business: string;
    gstin: string;
    period: string;
    generated: string;
  },
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  const leftMax = pageW * 0.58 - MARGIN.left;
  const rightMax = pageW * 0.38 - MARGIN.right;

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    doc.setFillColor(...HEAD);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("GST PURCHASE REGISTER", MARGIN.left, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(fit(doc, opts.period, rightMax), pageW - MARGIN.right, 10, { align: "right" });
    doc.text(fit(doc, opts.business, leftMax), MARGIN.left, 16.5);
    doc.text(fit(doc, `GSTIN  ${opts.gstin}`, leftMax), MARGIN.left, 22);
    doc.text(fit(doc, `Generated  ${opts.generated}`, rightMax), pageW - MARGIN.right, 22, {
      align: "right",
    });

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN.left, pageH - 11, pageW - MARGIN.right, pageH - 11);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text("Amounts in INR. Working paper for GSTR-2B / ITC — verify before filing.", MARGIN.left, pageH - 6);
    doc.text(`Page ${i} of ${pages}`, pageW - MARGIN.right, pageH - 6, { align: "right" });
  }
}

function billBody(rows: Purchase[]) {
  return sorted(rows).map((row, i) => [
    String(i + 1),
    formatDate(row.invoice_date),
    row.invoice_number || "—",
    row.supplier_name || "—",
    row.supplier_gstin || "—",
    rateLabel(row),
    money(row.taxable_value),
    money(row.cgst),
    money(row.sgst),
    money(row.igst),
    money(row.invoice_total),
    inputLabel(row.input_status),
  ]);
}

const tableBase = {
  theme: "plain" as const,
  margin: MARGIN,
  tableWidth: INNER,
  showHead: "everyPage" as const,
  showFoot: "lastPage" as const,
  styles: {
    font: "helvetica" as const,
    textColor: INK,
    lineColor: LINE,
    lineWidth: 0.15,
    valign: "middle" as const,
    minCellHeight: 6.2,
  },
  headStyles: {
    fillColor: HEAD,
    textColor: 255,
    fontStyle: "bold" as const,
    cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
  },
  footStyles: {
    fillColor: FOOT,
    textColor: INK,
    fontStyle: "bold" as const,
  },
  alternateRowStyles: { fillColor: BAND },
};

function billTable(doc: jsPDF, rows: Purchase[], startY: number) {
  const totals = totalsOf(rows);
  autoTable(doc, {
    ...tableBase,
    startY,
    styles: {
      ...tableBase.styles,
      fontSize: 7.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.4, right: 1.4 },
      overflow: "ellipsize",
    },
    headStyles: { ...tableBase.headStyles, fontSize: 7.5 },
    footStyles: { ...tableBase.footStyles, fontSize: 7.5 },
    head: [["#", "Date", "Invoice", "Party", "GSTIN", "Rate", "Taxable", "CGST", "SGST", "IGST", "Total", "Input"]],
    body: billBody(rows),
    foot: [
      [
        { content: `${totals.count} bills`, colSpan: 6, styles: { halign: "left" } },
        money(totals.taxable),
        money(totals.cgst),
        money(totals.sgst),
        money(totals.igst),
        money(totals.total),
        `${totals.gotCount} got`,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 10, halign: "right" },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 46, overflow: "linebreak" },
      4: { cellWidth: 32, fontSize: 6.5 },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 18, halign: "right" },
      10: { cellWidth: 22, halign: "right" },
      11: { cellWidth: 14, halign: "center" },
    },
  });
}

function summaryTable(doc: jsPDF, months: MonthBucket[], startY: number) {
  const body = months.map((bucket) => {
    const t = totalsOf(bucket.rows);
    return [
      bucket.label,
      String(t.count),
      money(t.taxable),
      money(t.gst),
      money(t.total),
      money(t.gotGst),
      money(t.waitingGst),
      money(t.missingGst),
    ];
  });
  const all = totalsOf(months.flatMap((bucket) => bucket.rows));
  autoTable(doc, {
    ...tableBase,
    startY,
    styles: {
      ...tableBase.styles,
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 1.6, right: 1.6 },
    },
    headStyles: { ...tableBase.headStyles, fontSize: 8 },
    head: [["Month", "Bills", "Taxable", "GST", "Total", "Got", "Waiting", "No"]],
    body,
    foot: [
      [
        "Year total",
        String(all.count),
        money(all.taxable),
        money(all.gst),
        money(all.total),
        money(all.gotGst),
        money(all.waitingGst),
        money(all.missingGst),
      ],
    ],
    columnStyles: {
      0: { cellWidth: 36, fontStyle: "bold" },
      1: { cellWidth: 18, halign: "right" },
      2: { cellWidth: 36.5, halign: "right" },
      3: { cellWidth: 36.5, halign: "right" },
      4: { cellWidth: 36.5, halign: "right" },
      5: { cellWidth: 36.5, halign: "right" },
      6: { cellWidth: 36.5, halign: "right" },
      7: { cellWidth: 36.5, halign: "right" },
    },
  });
}

export function downloadPurchasePdf(
  rows: Purchase[],
  opts: {
    profile: Profile | null;
    periodLabel: string;
    months?: MonthBucket[];
  },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const totals = totalsOf(rows);
  const business = opts.profile?.business_name?.trim() || "My business";
  const gstin = opts.profile?.gstin?.trim() || "Not set";
  const generated = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setProperties({
    title: `GST Purchase Register — ${opts.periodLabel}`,
    subject: "Purchase register for ITC / GSTR-2B working",
    author: business,
    creator: "GST Registry",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const kpi = [
    `${totals.count} bills`,
    `Taxable  ${money(totals.taxable)}`,
    `CGST  ${money(totals.cgst)}`,
    `SGST  ${money(totals.sgst)}`,
    `IGST  ${money(totals.igst)}`,
    `Total  ${money(totals.total)}`,
    `Got  ${money(totals.gotGst)}`,
    `Waiting  ${money(totals.waitingGst)}`,
    `No  ${money(totals.missingGst)}`,
  ].join("   ·   ");
  doc.text(kpi, MARGIN.left, 33.4, { maxWidth: INNER });

  let y = MARGIN.top;
  if (opts.months && opts.months.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Monthly summary", MARGIN.left, y);
    summaryTable(doc, opts.months, y + 3);
    y = lastY(doc) + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    if (y > doc.internal.pageSize.getHeight() - 48) {
      doc.addPage();
      y = MARGIN.top;
    }
    doc.text("Bill-wise register", MARGIN.left, y);
    y += 3;
  }

  billTable(doc, rows, y);
  drawChrome(doc, { business, gstin, period: opts.periodLabel, generated });
  doc.save(`GST-Register-${fileStamp(opts.periodLabel)}.pdf`);
}
