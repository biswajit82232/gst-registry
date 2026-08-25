"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { MonthBar } from "@/components/month-bar";
import { PurchaseCard, PurchaseList, ShowMore } from "@/components/purchase-card";
import { Alert, Button, Empty, UndoBar, inputClass } from "@/components/ui";
import { useWindowed } from "@/components/use-windowed";
import { formatCompact, monthRange } from "@/lib/format";
import { totalsOf } from "@/lib/gst";
import { isClaimable } from "@/lib/input";
import { useRegistry } from "@/lib/offline/registry";
import type { InputStatus } from "@/lib/types";

type Filter = "waiting" | "got" | "missing" | "all";

function parseFilter(raw: string | null): Filter {
  if (raw === "got" || raw === "missing" || raw === "all" || raw === "waiting") return raw;
  return "waiting";
}

export default function PurchasesPage() {
  return (
    <Suspense>
      <PurchasesInner />
    </Suspense>
  );
}

function PurchasesInner() {
  const searchParams = useSearchParams();
  const { purchases, markInput, markManyInput, syncError, month, setMonth } = useRegistry();
  const urlFilter = searchParams.get("filter");
  const urlQ = searchParams.get("q");
  const urlKey = `${urlFilter ?? ""}|${urlQ ?? ""}`;
  const [urlSeen, setUrlSeen] = useState(urlKey);
  const [q, setQ] = useState(urlQ ?? "");
  const [filter, setFilter] = useState<Filter>(() => parseFilter(urlFilter));
  if (urlSeen !== urlKey) {
    setUrlSeen(urlKey);
    setFilter(parseFilter(urlFilter));
    if (urlQ) setQ(urlQ);
  }
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const undoTimer = useRef<number>(0);

  const range = monthRange(month);
  const rows = useMemo(
    () =>
      purchases.filter((row) => row.invoice_date >= range.start && row.invoice_date <= range.end),
    [purchases, range.start, range.end],
  );
  const totals = useMemo(() => totalsOf(rows), [rows]);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "waiting" && !(isClaimable(row) && row.input_status === "waiting")) {
        return false;
      }
      if (filter === "got" && row.input_status !== "got") return false;
      if (filter === "missing" && row.input_status !== "missing") return false;
      if (!query) return true;
      return [row.supplier_name, row.invoice_number, row.supplier_gstin, row.purchased_by]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [rows, q, filter]);
  const windowed = useWindowed(visible, `${month}:${filter}:${q}:${visible.length}`);

  function queueUndo(ids: string[]) {
    setUndoIds(ids);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoIds([]), 5000);
  }

  async function mark(id: string, status: InputStatus) {
    try {
      await markInput(id, status);
      setHint("");
      if (status === "got") queueUndo([id]);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not update this bill.");
    }
  }

  async function markVisibleGot() {
    const ids = visible
      .filter((row) => isClaimable(row) && row.input_status === "waiting")
      .map((r) => r.id);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await markManyInput(ids, "got");
      setHint("");
      queueUndo(ids);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not update these bills.");
    } finally {
      setBusy(false);
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
      <p className="text-[11px] text-muted">
        Wait {formatCompact(totals.waitingGst)} · Got {formatCompact(totals.gotGst)}
      </p>
      <MonthBar month={month} onChange={setMonth} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          enterKeyHint="search"
          autoCorrect="off"
          autoCapitalize="none"
          aria-label="Search bills"
          className={inputClass("pl-7")}
          placeholder="Supplier, invoice, GSTIN"
          value={q}
          onChange={(e) => {
            const next = e.target.value;
            setQ(next);
            if (next.trim()) setFilter("all");
          }}
        />
      </div>
      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]" role="tablist" aria-label="Filter">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={filter === chip.id}
              onClick={() => setFilter(chip.id)}
              className={`h-8 min-h-8 shrink-0 rounded-full px-2.5 text-[11px] font-medium ${
                filter === chip.id
                  ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950"
                  : "border border-line bg-bg-elev"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {filter === "waiting" && !q.trim() && visible.length > 0 ? (
          <Button size="sm" onClick={markVisibleGot} disabled={busy} className="shrink-0">
            {busy ? "…" : `Got ${visible.length}`}
          </Button>
        ) : null}
      </div>
      {hint || syncError ? <Alert tone="danger">{hint || syncError}</Alert> : null}
      {undoIds.length > 0 ? (
        <UndoBar
          message={undoIds.length === 1 ? "Marked got" : `Marked ${undoIds.length} got`}
          onUndo={() => {
            void markManyInput(undoIds, "waiting");
            setUndoIds([]);
          }}
        />
      ) : null}
      {visible.length === 0 ? (
        <Empty title="Nothing in this list" hint="Change month or filter." />
      ) : (
        <PurchaseList>
          {windowed.visible.map((row) => (
            <PurchaseCard
              key={row.id}
              purchase={row}
              onGotInput={row.input_status === "waiting" ? (id) => mark(id, "got") : undefined}
            />
          ))}
          <ShowMore remaining={windowed.remaining} onClick={windowed.showMore} />
        </PurchaseList>
      )}
    </div>
  );
}
