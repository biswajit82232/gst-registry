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
    <div className="space-y-5">
      <div className="flex gap-2">
        <input
          className={inputClass("flex-1")}
          placeholder="Search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
        />
        <Link
          href="/suppliers/new"
          className="inline-flex h-11 shrink-0 items-center rounded-md bg-teal-800 px-4 text-[14px] font-medium text-white active:opacity-80 dark:bg-teal-400 dark:text-teal-950"
        >
          Add
        </Link>
      </div>

      {missingSuppliersTable ? (
        <Alert>Party list is local-only until the suppliers table exists in Supabase.</Alert>
      ) : null}

      {rows.length === 0 ? (
        <Empty title={q ? "No match" : "No parties yet"} hint="Save a bill — new names are stored here.">
          <Link href="/purchases/new" className="mt-4 inline-block text-[14px] font-medium text-ink">
            Add a bill
          </Link>
        </Empty>
      ) : (
        <div className="divide-y divide-line">
          {rows.map(({ supplier, bills, totals }) => (
            <Link
              key={supplier.id}
              href={`/suppliers/${supplier.id}`}
              prefetch
              className="-mx-4 flex items-center justify-between gap-3 px-4 py-3.5 active:bg-line/35"
            >
              <div className="min-w-0">
                <p className="truncate text-[16px] font-medium leading-tight">{supplier.name}</p>
                <p className="mt-1 truncate text-[13px] text-muted">
                  {supplier.gstin || "No GSTIN"}
                  {bills.length ? ` · ${bills.length} bill${bills.length === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              {totals.gst > 0 ? (
                <p className="tabular shrink-0 text-[14px] text-muted">{formatCompact(totals.gst)}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
