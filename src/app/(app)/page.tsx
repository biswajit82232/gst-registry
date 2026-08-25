"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MonthBar } from "@/components/month-bar";
import { PurchaseCard, PurchaseList, ShowMore } from "@/components/purchase-card";
import { useWindowed } from "@/components/use-windowed";
import { Alert, Empty, StatStrip, UndoBar } from "@/components/ui";
import { financialYear, formatCompact, formatInr, monthRange } from "@/lib/format";
import { totalsOf } from "@/lib/gst";
import { isClaimable } from "@/lib/input";
import { useRegistry } from "@/lib/offline/registry";

export default function HomePage() {
  const { purchases, markInput, syncError, month, setMonth } = useRegistry();
  const [hint, setHint] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<number>(0);

  const range = monthRange(month);
  const fy = financialYear();
  const rows = useMemo(
    () =>
      purchases.filter((row) => row.invoice_date >= range.start && row.invoice_date <= range.end),
    [purchases, range.start, range.end],
  );
  const fyRows = useMemo(
    () => purchases.filter((row) => row.invoice_date >= fy.start && row.invoice_date <= fy.end),
    [purchases, fy.start, fy.end],
  );
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const fyTotals = useMemo(() => totalsOf(fyRows), [fyRows]);
  const waiting = useMemo(
    () => rows.filter((row) => isClaimable(row) && row.input_status === "waiting"),
    [rows],
  );
  const windowed = useWindowed(waiting, `${month}:${waiting.length}`);

  async function markGot(id: string) {
    try {
      await markInput(id, "got");
      setHint("");
      setUndoId(id);
      window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndoId(null), 5000);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not update this bill.");
    }
  }

  return (
    <div className="space-y-2">
      <MonthBar month={month} onChange={setMonth} />

      <StatStrip
        items={[
          {
            label: "Wait",
            value: formatCompact(totals.waitingGst),
            accent: totals.waitingGst > 0,
            href: "/purchases?filter=waiting",
          },
          { label: "Got", value: formatCompact(totals.gotGst), href: "/purchases?filter=got" },
          { label: "GST", value: formatCompact(totals.gst), href: "/purchases?filter=all" },
          { label: "Bills", value: String(totals.count), href: "/purchases?filter=all" },
        ]}
      />

      <p className="text-[11px] text-muted">
        {fy.label}: {formatInr(fyTotals.gotGst)} got · {formatInr(fyTotals.waitingGst)} waiting
      </p>

      {totals.missingGst > 0 ? (
        <Alert tone="danger">{formatInr(totals.missingGst)} marked not received.</Alert>
      ) : null}

      {(totals.missingGstin > 0 || totals.unpaid > 0) && (
        <Alert>
          {totals.missingGstin > 0
            ? `${totals.missingGstin} missing GSTIN. `
            : null}
          {totals.unpaid > 0
            ? `${totals.unpaid} unpaid — ITC may reverse after 180 days.`
            : "Add GSTIN for 2B matching."}
        </Alert>
      )}

      {hint || syncError ? <Alert tone="danger">{hint || syncError}</Alert> : null}
      {undoId ? (
        <UndoBar
          message="Marked got"
          onUndo={() => {
            void markInput(undoId, "waiting");
            setUndoId(null);
          }}
        />
      ) : null}

      <div className="flex items-baseline justify-between">
        <h2 className="text-[12px] font-semibold">Waiting</h2>
        <Link href="/purchases?filter=waiting" className="text-[11px] text-teal-700 dark:text-teal-300">
          All bills
        </Link>
      </div>

      {rows.length === 0 ? (
        <Empty title="No bills this month" hint="Log a purchase, then tap Got after GSTR-2B.">
          <Link
            href="/purchases/new"
            className="mt-2 inline-flex h-10 min-h-10 items-center rounded-md bg-teal-700 px-3 text-[12px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
          >
            Add bill
          </Link>
        </Empty>
      ) : waiting.length === 0 ? (
        <p className="rounded-md border border-line bg-bg-elev px-2 py-2 text-[12px] text-muted">
          Nothing waiting. Claimable GST is marked Got or Not received.
        </p>
      ) : (
        <PurchaseList>
          {windowed.visible.map((row) => (
            <PurchaseCard key={row.id} purchase={row} onGotInput={markGot} />
          ))}
          <ShowMore remaining={windowed.remaining} onClick={windowed.showMore} />
        </PurchaseList>
      )}
    </div>
  );
}
