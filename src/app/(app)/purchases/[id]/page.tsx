"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { PurchaseForm } from "@/components/purchase-form";
import { Alert, Button } from "@/components/ui";
import { formatDate, formatInr, formatMoney } from "@/lib/format";
import { gstOf, inputLabel } from "@/lib/input";
import { useRegistry } from "@/lib/offline/registry";
import type { InputStatus } from "@/lib/types";

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { purchases, profile, markInput, deletePurchase } = useRegistry();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  const purchase = useMemo(
    () => purchases.find((row) => row.id === params.id) ?? null,
    [purchases, params.id],
  );

  async function remove() {
    if (!purchase || !confirm("Delete this bill?")) return;
    setBusy(true);
    try {
      await deletePurchase(purchase.id);
      router.push("/purchases");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete this bill.");
      setBusy(false);
    }
  }

  async function mark(status: InputStatus) {
    if (!purchase) return;
    setBusy(true);
    try {
      await markInput(purchase.id, status);
      setHint("");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not update this bill.");
    } finally {
      setBusy(false);
    }
  }

  if (!purchase) {
    return (
      <p className="text-[12px] text-muted">
        Bill not found.{" "}
        <Link href="/purchases" className="text-teal-700 dark:text-teal-300">
          Back
        </Link>
      </p>
    );
  }

  if (editing) {
    return (
      <div>
        <button type="button" className="mb-2 text-[12px] text-muted" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <PurchaseForm profile={profile} purchase={purchase} />
      </div>
    );
  }

  const gst = gstOf(purchase);
  const rows: [string, string][] = [
    ["GSTIN", purchase.supplier_gstin || "Missing"],
    ["Purchaser", purchase.purchased_by || "—"],
    ["Taxable", formatMoney(purchase.taxable_value)],
    ["GST", `${formatMoney(gst)} (${purchase.gst_rate}%)`],
    ["CGST", formatMoney(purchase.cgst)],
    ["SGST", formatMoney(purchase.sgst)],
    ["IGST", formatMoney(purchase.igst)],
    ["ITC", purchase.itc_eligible ? "Eligible" : "Not eligible"],
    ["Input", inputLabel(purchase.input_status)],
    ["Payment", purchase.payment_status],
    ["Place", purchase.place_of_supply || "—"],
    ["HSN", purchase.hsn_sac || "—"],
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted">
            {formatDate(purchase.invoice_date)}
            {purchase.invoice_number.trim() ? ` · #${purchase.invoice_number}` : ""}
          </p>
          <p className="truncate text-[16px] font-semibold leading-tight">
            {purchase.supplier_id ? (
              <Link href={`/suppliers/${purchase.supplier_id}`} className="underline-offset-2 hover:underline">
                {purchase.supplier_name}
              </Link>
            ) : (
              purchase.supplier_name
            )}
          </p>
        </div>
        <p className="tabular shrink-0 text-[16px] font-bold">{formatInr(purchase.invoice_total)}</p>
      </div>

      {purchase.itc_eligible ? (
        <div className="space-y-1">
          <p className="text-[11px] text-muted">GST input {formatMoney(gst)}</p>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Input status">
            {(["got", "waiting", "missing"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={
                  purchase.input_status === status
                    ? status === "missing"
                      ? "danger"
                      : "primary"
                    : "outline"
                }
                disabled={busy}
                onClick={() => mark(status)}
              >
                {status === "got" ? "Got" : status === "waiting" ? "Wait" : "No"}
              </Button>
            ))}
          </div>
          {hint ? <Alert tone="danger">{hint}</Alert> : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-line bg-bg-elev px-2 py-1.5 text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 justify-between gap-2">
            <dt className="shrink-0 text-muted">{label}</dt>
            <dd className="truncate text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {purchase.notes ? (
        <p className="rounded-md border border-line bg-bg-elev px-2 py-1.5 text-[12px]">{purchase.notes}</p>
      ) : null}
      <div className="flex gap-1.5">
        <Button className="flex-1" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button variant="danger" onClick={remove} disabled={busy} aria-label="Delete bill">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
