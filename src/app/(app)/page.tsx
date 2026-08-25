"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MonthBar } from "@/components/month-bar";
import { PurchaseCard, PurchaseList, ShowMore } from "@/components/purchase-card";
import { useWindowed } from "@/components/use-windowed";
import { Alert, Empty, StatStrip, UndoBar } from "@/components/ui";
import { formatCompact, monthRange } from "@/lib/format";
import { totalsOf } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";

type Filter = "waiting" | "got" | "missing" | "all";

export default function HomePage() {
  const { purchases, markInput, syncError, month, setMonth } = useRegistry();
  const [filter, setFilter] = useState<Filter>("waiting");
  const [hint, setHint] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<number>(0);

  const range = monthRange(month);
  const rows = useMemo(
    () =>
      purchases.filter((row) => row.invoice_date >= range.start && row.invoice_date <= range.end),
    [purchases, range.start, range.end],
  );
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.input_status === filter);
  }, [rows, filter]);
  const windowed = useWindowed(visible, `${month}:${filter}:${visible.length}`);

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

  const chips: { id: Filter; label: string }[] = [
    { id: "waiting", label: `Wait ${totals.waitingCount}` },
    { id: "got", label: `Got ${totals.gotCount}` },
    { id: "missing", label: "No" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="space-y-2">
      <MonthBar month={month} onChange={setMonth} />
      <StatStrip
        items={[
          { label: "Wait", value: formatCompact(totals.waitingGst), accent: totals.waitingGst > 0 },
          { label: "Got", value: formatCompact(totals.gotGst) },
          { label: "Bills", value: String(totals.count) },
        ]}
      />
      <div className="flex gap-1 overflow-x-auto overscroll-x-contain" role="tablist" aria-label="Filter">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={filter === chip.id}
            onClick={() => setFilter(chip.id)}
            className={`h-8 min-h-8 shrink-0 rounded-full px-2.5 text-[12px] font-medium ${
              filter === chip.id
                ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950"
                : "border border-line bg-bg-elev"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
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
      {visible.length === 0 ? (
        <Empty
          title={rows.length === 0 ? "No bills this month" : "Nothing in this list"}
          hint={rows.length === 0 ? "Add a purchase. Mark Got when the GST shows in 2B." : "Try another filter."}
        >
          {rows.length === 0 ? (
            <Link
              href="/purchases/new"
              className="mt-2 inline-flex h-10 min-h-10 items-center rounded-md bg-teal-700 px-3 text-[13px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
            >
              Add bill
            </Link>
          ) : null}
        </Empty>
      ) : (
        <PurchaseList>
          {windowed.visible.map((row) => (
            <PurchaseCard
              key={row.id}
              purchase={row}
              onGotInput={row.input_status === "waiting" ? markGot : undefined}
            />
          ))}
          <ShowMore remaining={windowed.remaining} onClick={windowed.showMore} />
        </PurchaseList>
      )}
    </div>
  );
}
