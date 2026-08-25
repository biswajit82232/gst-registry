"use client";

import { memo } from "react";
import Link from "next/link";
import { formatDate, formatInr } from "@/lib/format";
import { gstOf, inputLabel } from "@/lib/input";
import type { Purchase } from "@/lib/types";

export const PurchaseCard = memo(function PurchaseCard({
  purchase,
  onGotInput,
}: {
  purchase: Purchase;
  onGotInput?: (id: string) => void;
}) {
  const gst = gstOf(purchase);
  const showGot = onGotInput && purchase.input_status === "waiting";
  const status = purchase.input_status;
  const statusClass =
    status === "got"
      ? "text-emerald-700 dark:text-emerald-300"
      : status === "missing"
        ? "text-rose-700 dark:text-rose-300"
        : "text-amber-700 dark:text-amber-300";

  return (
    <div className="list-row flex items-stretch gap-1 px-2 py-2">
      <Link href={`/purchases/${purchase.id}`} prefetch className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-semibold leading-tight">{purchase.supplier_name}</p>
          <p className="tabular shrink-0 text-[14px] font-semibold">
            {formatInr(purchase.invoice_total)}
          </p>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-muted">
          <span>
            {formatDate(purchase.invoice_date)}
            {purchase.invoice_number.trim() ? ` · ${purchase.invoice_number}` : ""}
          </span>
          <span className={statusClass}>{inputLabel(status)}</span>
          {gst > 0 ? <span>GST {formatInr(gst)}</span> : null}
        </p>
      </Link>
      {showGot ? (
        <button
          type="button"
          onClick={() => onGotInput(purchase.id)}
          className="my-auto h-9 min-w-11 shrink-0 rounded-md bg-teal-700 px-2.5 text-[12px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
        >
          Got
        </button>
      ) : null}
    </div>
  );
});

export function PurchaseList({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-bg-elev">
      {children}
    </div>
  );
}

export function ShowMore({
  remaining,
  onClick,
}: {
  remaining: number;
  onClick: () => void;
}) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-10 w-full items-center justify-center text-[12px] font-medium text-teal-700 dark:text-teal-300"
    >
      Show {remaining} more
    </button>
  );
}
