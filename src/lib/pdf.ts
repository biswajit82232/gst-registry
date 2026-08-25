import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatMoney } from "./format";
import { totalsOf } from "./gst";
import { inputLabel } from "./input";
import type { Profile, Purchase } from "./types";

function rs(n: number): string {
  return formatMoney(n).replace("₹", "Rs. ");
}

export function downloadPurchasePdf(
  rows: Purchase[],
  opts: {
    profile: Profile | null;
    periodLabel: string;
  },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const totals = totalsOf(rows);
  const business = opts.profile?.business_name || "My business";
  const gstin = opts.profile?.gstin || "GSTIN not set";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("GST Purchase Register", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(business, 14, 23);
  doc.text(`GSTIN: ${gstin}   Period: ${opts.periodLabel}`, 14, 29);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 35);

  autoTable(doc, {
    startY: 40,
    head: [
      [
        "Date",
        "Invoice",
        "Supplier",
        "GSTIN",
        "Taxable",
        "CGST",
        "SGST",
        "IGST",
        "Total",
        "Input",
      ],
    ],
    body: rows.map((row) => [
      formatDate(row.invoice_date),
      row.invoice_number,
      row.supplier_name,
      row.supplier_gstin || "—",
      rs(row.taxable_value),
      rs(row.cgst),
      rs(row.sgst),
      rs(row.igst),
      rs(row.invoice_total),
      inputLabel(row.input_status),
    ]),
    foot: [
      [
        "",
        "",
        `${totals.count} bills`,
        "",
        rs(totals.taxable),
        rs(totals.cgst),
        rs(totals.sgst),
        rs(totals.igst),
        rs(totals.total),
        `${totals.gotCount} got`,
      ],
    ],
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [13, 148, 136], textColor: 255 },
    footStyles: { fillColor: [240, 253, 250], textColor: 20, fontStyle: "bold" },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
  });

  const y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
  doc.setFontSize(10);
  doc.text(
    `GST paid: ${rs(totals.gst)}    Got input: ${rs(totals.gotGst)}    Waiting: ${rs(totals.waitingGst)}    Not received: ${rs(totals.missingGst)}`,
    14,
    y + 10,
  );
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    "For CA reconciliation with GSTR-2B. Verify supplier GSTIN, invoice number and tax split before filing.",
    14,
    y + 16,
  );

  const safePeriod = opts.periodLabel.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  doc.save(`GST-Purchase-Register-${safePeriod}.pdf`);
}
