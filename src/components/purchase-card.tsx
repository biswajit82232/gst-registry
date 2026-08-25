"use client";

import { memo } from "react";
import Link from "next/link";
import { formatDate, formatInr } from "@/lib/format";
import { gstOf, inputLabel } from "@/lib/input";
import type { Purchase } from "@/lib/types";

function statusClass(status: Purchase["input_status"]) {
  if (status === "got") return "text-emerald-700 dark:text-emerald-300";
  if (status === "missing") return "text-rose-700 dark:text-rose-300";
  return "text-muted";
}

export const PurchaseCard = memo(function PurchaseCard({
  purchase,
  onGotInput,
}: {
  purchase: Purchase;
  onGotInput?: (id: string) => void;
}) {
  const gst = gstOf(purchase);
  const showGot = onGotInput && purchase.input_status === "waiting";

  return (
    <div className="list-row -mx-4 flex items-start gap-3 px-4 py-3.5 touch-pan-y active:bg-line/35">
      <Link href={`/purchases/${purchase.id}`} prefetch draggable={false} className="min-w-0 flex-1 touch-pan-y">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[16px] font-medium leading-tight">{purchase.supplier_name}</p>
          <p className="tabular shrink-0 text-[16px] font-medium tracking-tight">
            {formatInr(purchase.invoice_total)}
          </p>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          <span>
            {formatDate(purchase.invoice_date)}
            {purchase.invoice_number.trim() ? ` · ${purchase.invoice_number}` : ""}
          </span>
          {gst > 0 ? <span>GST {formatInr(gst)}</span> : null}
          <span className={statusClass(purchase.input_status)}>{inputLabel(purchase.input_status)}</span>
        </p>
      </Link>
      {showGot ? (
        <button
          type="button"
          onClick={() => onGotInput(purchase.id)}
          className="mt-0.5 h-10 shrink-0 text-[13px] font-medium text-teal-800 active:opacity-60 dark:text-teal-300"
        >
          Got
        </button>
      ) : null}
    </div>
  );
});

export function PurchaseList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line">{children}</div>;
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
      className="flex min-h-12 w-full items-center justify-center text-[13px] text-muted active:opacity-60"
    >
      Show {remaining} more
    </button>
  );
}
