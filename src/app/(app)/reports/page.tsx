"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileUp, Printer } from "lucide-react";
import { MonthBar } from "@/components/month-bar";
import { ShowMore } from "@/components/purchase-card";
import { Alert, Button, Empty, StatStrip } from "@/components/ui";
import { useWindowed } from "@/components/use-windowed";
import {
  csvTemplate,
  downloadText,
  parsePurchaseCsv,
  purchasesToCsv,
} from "@/lib/csv";
import { financialYear, formatCompact, formatInr, monthLabel, monthRange } from "@/lib/format";
import { totalsOf } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";

type Scope = "month" | "fy";

export default function ReportsPage() {
  const { purchases, profile, importPurchases, month, setMonth } = useRegistry();
  const [scope, setScope] = useState<Scope>("month");
  const [status, setStatus] = useState("");

  const range = scope === "fy" ? financialYear() : monthRange(month);
  const rows = useMemo(
    () =>
      purchases
        .filter((row) => row.invoice_date >= range.start && row.invoice_date <= range.end)
        .slice()
        .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date)),
    [purchases, range.start, range.end],
  );
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const periodLabel = scope === "fy" ? financialYear().label : monthLabel(month);
  const windowed = useWindowed(rows, `${scope}:${month}:${rows.length}`);

  async function onImport(file: File) {
    setStatus("");
    const text = await file.text();
    const { rows: incoming, errors } = parsePurchaseCsv(text);
    if (incoming.length === 0) {
      setStatus(errors[0] || "No valid rows found.");
      return;
    }
    try {
      const count = await importPurchases(incoming);
      setStatus(`Imported ${count}. ${errors.length ? errors.slice(0, 2).join(" ") : ""}`);
      setScope("fy");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["month", "fy"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={`h-8 min-h-8 rounded-full px-2.5 text-[11px] font-semibold ${
              scope === id
                ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950"
                : "border border-line bg-bg-elev"
            }`}
          >
            {id === "month" ? "Month" : financialYear().label}
          </button>
        ))}
      </div>

      {scope === "month" ? <MonthBar month={month} onChange={setMonth} /> : null}

      <StatStrip
        items={[
          { label: "Bills", value: String(totals.count) },
          { label: "GST", value: formatCompact(totals.gst) },
          { label: "Got", value: formatCompact(totals.gotGst) },
          { label: "Wait", value: formatCompact(totals.waitingGst), accent: totals.waitingGst > 0 },
        ]}
      />

      <div className="grid grid-cols-2 gap-1">
        <Button
          size="sm"
          onClick={async () => {
            const { downloadPurchasePdf } = await import("@/lib/pdf");
            downloadPurchasePdf(rows, { profile, periodLabel });
          }}
          disabled={rows.length === 0}
        >
          <Printer className="h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadText(
              `gst-purchases-${periodLabel.replace(/\s+/g, "-")}.csv`,
              purchasesToCsv(rows),
              "text/csv;charset=utf-8",
            )
          }
          disabled={rows.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <label className="inline-flex h-9 min-h-9 cursor-pointer items-center justify-center gap-1 rounded-md border border-line bg-bg-elev px-2 text-[12px] font-semibold">
          <FileUp className="h-3.5 w-3.5" />
          Import
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = "";
            }}
          />
        </label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            downloadText("gst-registry-template.csv", csvTemplate(), "text/csv;charset=utf-8")
          }
        >
          Template
        </Button>
      </div>

      {status ? <Alert tone="muted">{status}</Alert> : null}

      {rows.length === 0 ? (
        <Empty title="No bills in this period" />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-bg-elev">
          {windowed.visible.map((row) => (
            <Link
              key={row.id}
              href={`/purchases/${row.id}`}
              prefetch
              className="list-row flex min-h-11 items-baseline justify-between gap-2 px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{row.supplier_name}</p>
                <p className="text-[10px] text-muted">
                  {row.invoice_date}
                  {row.invoice_number.trim() ? ` · #${row.invoice_number}` : ""} ·{" "}
                  {row.input_status === "got" ? "Got" : row.input_status === "missing" ? "No" : "Wait"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular text-[12px] font-semibold">{formatInr(row.invoice_total)}</p>
                <p className="tabular text-[10px] text-muted">
                  GST {formatInr(row.cgst + row.sgst + row.igst)}
                </p>
              </div>
            </Link>
          ))}
          <ShowMore remaining={windowed.remaining} onClick={windowed.showMore} />
        </div>
      )}
    </div>
  );
}
