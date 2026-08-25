"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Empty, inputClass } from "@/components/ui";
import { formatCompact } from "@/lib/format";
import { billsForSupplier } from "@/lib/input";
import { totalsOf } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";

export default function SuppliersPage() {
  const { suppliers, purchases, missingSuppliersTable } = useRegistry();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query
      ? suppliers.filter((s) =>
          [s.name, s.gstin, s.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(query)),
        )
      : suppliers;
    return list
      .map((supplier) => {
        const bills = billsForSupplier(purchases, supplier);
        const totals = totalsOf(bills);
        return { supplier, bills, totals };
      })
      .sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
  }, [purchases, q, suppliers]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <input
          className={inputClass("flex-1")}
          placeholder="Search parties"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <Link
          href="/suppliers/new"
          className="inline-flex h-9 shrink-0 items-center rounded-md bg-teal-700 px-3 text-[13px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
        >
          Add
        </Link>
      </div>

      {missingSuppliersTable ? (
        <Alert>Party list is local-only until the suppliers table exists in Supabase.</Alert>
      ) : null}

      {rows.length === 0 ? (
        <Empty title={q ? "No match" : "No parties yet"} hint="Save a bill — new names are stored here.">
          <Link href="/purchases/new" className="mt-2 inline-block text-[13px] font-medium text-teal-700 dark:text-teal-300">
            Add a bill
          </Link>
        </Empty>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-bg-elev">
          {rows.map(({ supplier, bills, totals }) => (
            <Link
              key={supplier.id}
              href={`/suppliers/${supplier.id}`}
              prefetch
              className="flex items-center justify-between gap-2 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold leading-tight">{supplier.name}</p>
                <p className="truncate text-[11px] text-muted">
                  {supplier.gstin || "No GSTIN"}
                  {bills.length ? ` · ${bills.length} bill${bills.length === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <p className="tabular shrink-0 text-[13px] font-medium">
                {totals.gst > 0 ? formatCompact(totals.gst) : bills.length ? "—" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
