"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PurchaseForm, StatusPicker } from "@/components/purchase-form";
import { Alert, Button, Confirm } from "@/components/ui";
import { formatDate, formatInr } from "@/lib/format";
import { decodeLines, lineGst, lineTotal, toNumber } from "@/lib/gst";
import { gstOf } from "@/lib/input";
import { useRegistry } from "@/lib/offline/registry";
import type { InputStatus } from "@/lib/types";

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { purchases, profile, suppliers, markInput, deletePurchase } = useRegistry();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const purchase = useMemo(
    () => purchases.find((row) => row.id === params.id) ?? null,
    [purchases, params.id],
  );
  const party = useMemo(() => {
    if (!purchase) return null;
    return (
      suppliers.find((row) => row.id === purchase.supplier_id) ??
      suppliers.find((row) => row.name.toLowerCase() === purchase.supplier_name.toLowerCase()) ??
      null
    );
  }, [purchase, suppliers]);
  const lines = useMemo(() => (purchase ? decodeLines(purchase) : []), [purchase]);
  const filled = lines.filter((line) => toNumber(line.taxable) > 0);

  async function remove() {
    if (!purchase) return;
    setBusy(true);
    setConfirmDelete(false);
    try {
      await deletePurchase(purchase.id);
      router.push("/");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not delete this bill.");
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
      <p className="text-[15px] text-muted">
        Bill not found.{" "}
        <Link href="/" className="font-medium text-ink">
          Back
        </Link>
      </p>
    );
  }

  if (editing) {
    return (
      <div>
        <button type="button" className="mb-4 min-h-11 text-[13px] text-muted active:opacity-60" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <PurchaseForm profile={profile} purchase={purchase} onSaved={() => setEditing(false)} />
      </div>
    );
  }

  const gst = gstOf(purchase);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {formatDate(purchase.invoice_date)}
            {purchase.invoice_number.trim() ? ` · ${purchase.invoice_number}` : ""}
          </p>
          {party ? (
            <Link href={`/suppliers/${party.id}`} className="mt-1 block truncate text-[20px] font-semibold tracking-tight">
              {purchase.supplier_name}
            </Link>
          ) : (
            <p className="mt-1 truncate text-[20px] font-semibold tracking-tight">{purchase.supplier_name}</p>
          )}
        </div>
        <p className="tabular shrink-0 text-[20px] font-semibold tracking-tight">{formatInr(purchase.invoice_total)}</p>
      </div>

      {filled.length > 1 ? (
        <ul className="divide-y divide-line">
          {filled.map((line, i) => (
            <li
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 py-2.5"
            >
              <span className="truncate text-[15px]">{line.rate}%</span>
              <span className="tabular text-[15px] font-medium">{formatInr(lineTotal(line))}</span>
              <span className="truncate text-[12px] text-muted sm:text-[13px]">
                GST {formatInr(lineGst(line))} · before GST {formatInr(toNumber(line.taxable))}
              </span>
            </li>
          ))}
        </ul>
      ) : gst > 0 ? (
        <p className="text-[14px] text-muted">GST {formatInr(gst)}</p>
      ) : null}

      {gst > 0 ? (
        <p className="tabular text-[13px] text-muted">
          {purchase.tax_type === "inter" ? (
            <>IGST {formatInr(purchase.igst)}</>
          ) : (
            <>
              CGST {formatInr(purchase.cgst)}
              <span className="mx-1.5 text-line">·</span>
              SGST {formatInr(purchase.sgst)}
            </>
          )}
        </p>
      ) : null}

      <StatusPicker value={purchase.input_status} onChange={(status) => !busy && void mark(status)} />
      {hint ? <Alert tone="danger">{hint}</Alert> : null}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setEditing(true)} disabled={busy}>
          Edit
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
          Delete
        </Button>
      </div>
      <Confirm
        open={confirmDelete}
        title="Delete this bill?"
        body="It will be removed from the register."
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
