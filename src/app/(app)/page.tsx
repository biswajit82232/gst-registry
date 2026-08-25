"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MonthBar } from "@/components/month-bar";
import { PurchaseCard, PurchaseList, ShowMore } from "@/components/purchase-card";
import { useWindowed } from "@/components/use-windowed";
import { useHorizontalSwipe } from "@/components/use-swipe";
import { Alert, Empty, UnderlineTabs, UndoBar } from "@/components/ui";
import { formatCompact, monthRange } from "@/lib/format";
import { totalsOf } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";

type Filter = "waiting" | "got" | "missing" | "all";

const FILTERS: Filter[] = ["waiting", "got", "missing", "all"];

function shiftFilter(current: Filter, dir: "left" | "right"): Filter {
  const i = FILTERS.indexOf(current);
  const delta = dir === "left" ? 1 : -1;
  return FILTERS[(i + delta + FILTERS.length) % FILTERS.length];
}

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
  const swipe = useHorizontalSwipe((dir) => {
    setFilter((current) => shiftFilter(current, dir));
  });

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
    <div className="space-y-5">
      <MonthBar month={month} onChange={setMonth} />
      <div className="touch-pan-y space-y-5" {...swipe}>
        <p className="sr-only">Swipe left or right to switch Waiting, Got, No, and All.</p>
        <p className="tabular text-[13px] text-muted">
          Waiting {formatCompact(totals.waitingGst)}
          <span className="mx-1.5 text-line">·</span>
          Got {formatCompact(totals.gotGst)}
          <span className="mx-1.5 text-line">·</span>
          {totals.count} {totals.count === 1 ? "bill" : "bills"}
        </p>
        <UnderlineTabs
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter"
          options={[
            { id: "waiting", label: `Waiting ${totals.waitingCount}` },
            { id: "got", label: `Got ${totals.gotCount}` },
            { id: "missing", label: "No" },
            { id: "all", label: "All" },
          ]}
        />
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
            hint={
              rows.length === 0
                ? "Add a purchase. Mark Got when the GST shows in 2B."
                : "Try another filter."
            }
          >
            {rows.length === 0 ? (
              <Link
                href="/purchases/new"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-teal-800 px-4 text-[14px] font-medium text-white active:opacity-80 dark:bg-teal-400 dark:text-teal-950"
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
    </div>
  );
}
