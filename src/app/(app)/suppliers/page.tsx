"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Alert, Empty, inputClass } from "@/components/ui";
import { ShowMore } from "@/components/purchase-card";
import { useWindowed } from "@/components/use-windowed";
import { formatCompact, formatInr } from "@/lib/format";
import { billsForSupplier, supplierReliability } from "@/lib/input";
import { useRegistry } from "@/lib/offline/registry";
import type { Purchase, Supplier } from "@/lib/types";

type Row = Supplier & {
  bills: number;
  gst: number;
  lastDate: string | null;
  purchases: Purchase[];
};

export default function SuppliersPage() {
  const { suppliers, purchases, missingSuppliersTable, userId } = useRegistry();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const grouped = new Map<string, Row>();
    if (suppliers.length > 0) {
      for (const s of suppliers) {
        const list = billsForSupplier(purchases, s);
        grouped.set(s.id, {
          ...s,
          bills: list.length,
          gst: list.reduce((sum, p) => sum + p.cgst + p.sgst + p.igst, 0),
          lastDate: list[0]?.invoice_date ?? null,
          purchases: list,
        });
      }
    } else {
      for (const p of purchases) {
        const key = `${(p.supplier_gstin || "").toUpperCase()}|${p.supplier_name.toLowerCase()}`;
        const current = grouped.get(key);
        const gst = p.cgst + p.sgst + p.igst;
        if (current) {
          current.bills += 1;
          current.gst += gst;
          current.purchases.push(p);
          if (!current.lastDate || p.invoice_date > current.lastDate) {
            current.lastDate = p.invoice_date;
          }
        } else {
          grouped.set(key, {
            id: key,
            user_id: userId ?? "",
            name: p.supplier_name,
            gstin: p.supplier_gstin,
            phone: null,
            notes: null,
            created_at: "",
            updated_at: "",
            bills: 1,
            gst,
            lastDate: p.invoice_date,
            purchases: [p],
          });
        }
      }
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, purchases, userId]);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) =>
      [r.name, r.gstin, r.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(query)),
    );
  }, [rows, q]);
  const windowed = useWindowed(visible, `${q}:${visible.length}`);

  const fallbackLinks = missingSuppliersTable && suppliers.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="none"
            aria-label="Search suppliers"
            className={inputClass("pl-7")}
            placeholder="Name or GSTIN"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Link
          href="/suppliers/new"
          className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-md bg-teal-700 px-2.5 text-[12px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Link>
      </div>

      {missingSuppliersTable ? (
        <Alert>Run supabase/suppliers.sql once so the directory syncs (phone, notes, reuse).</Alert>
      ) : null}

      {visible.length === 0 ? (
        <Empty title="No suppliers yet" hint="Add one, or save a bill — they are stored automatically." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-bg-elev">
          {windowed.visible.map((row) => (
            <Link
              key={row.id}
              href={fallbackLinks ? `/purchases?q=${encodeURIComponent(row.name)}` : `/suppliers/${row.id}`}
              prefetch
              className="list-row block min-h-11 px-2 py-1.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[13px] font-semibold">{row.name}</p>
                <p className="tabular shrink-0 text-[13px] font-semibold">{formatCompact(row.gst)}</p>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-muted">
                {row.gstin || "No GSTIN"} · {row.bills} bill{row.bills === 1 ? "" : "s"}
                {row.lastDate ? ` · ${row.lastDate}` : ""}
              </p>
              <Reliability purchases={row.purchases} />
            </Link>
          ))}
          <ShowMore remaining={windowed.remaining} onClick={windowed.showMore} />
        </div>
      )}
      {visible.length > 0 ? (
        <p className="text-center text-[10px] text-muted">
          {visible.length} · GST {formatInr(visible.reduce((s, r) => s + r.gst, 0))}
        </p>
      ) : null}
    </div>
  );
}

function Reliability({ purchases }: { purchases: Purchase[] }) {
  const score = supplierReliability(purchases);
  const tone =
    score.label === "Usually gives input"
      ? "text-emerald-700 dark:text-emerald-300"
      : score.label === "Often not passing ITC"
        ? "text-rose-700 dark:text-rose-300"
        : "text-muted";
  if (score.eligible === 0) return null;
  return (
    <p className={`text-[10px] font-medium ${tone}`}>
      {score.label} · {score.got}/{score.eligible} got
    </p>
  );
}
