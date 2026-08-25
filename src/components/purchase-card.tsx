"use client";

import { memo } from "react";
import { formatInr, formatListDate } from "@/lib/format";
import { gstOf, inputLabel } from "@/lib/input";
import type { Purchase } from "@/lib/types";
import { TwoLineRow } from "./ui";

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
  const invoice = purchase.invoice_number.trim();
  const meta = [formatListDate(purchase.invoice_date), invoice || null, gst > 0 ? `GST ${formatInr(gst)}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <TwoLineRow
      href={`/purchases/${purchase.id}`}
      title={purchase.supplier_name}
      value={formatInr(purchase.invoice_total)}
      meta={meta}
      aside={
        showGot ? (
          <button
            type="button"
            onClick={() => onGotInput(purchase.id)}
            className="inline-flex h-7 items-center rounded-md border border-line bg-bg-elev px-2.5 text-[12px] font-medium leading-none text-ink active:bg-line/60"
          >
            Got
          </button>
        ) : (
          <span className={`text-[12px] leading-4 sm:text-[13px] ${statusClass(purchase.input_status)}`}>
            {inputLabel(purchase.input_status)}
          </span>
        )
      }
    />
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
