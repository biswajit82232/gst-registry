"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PurchaseCard, PurchaseList } from "@/components/purchase-card";
import { SupplierForm } from "@/components/supplier-form";
import { Alert, Button, Confirm, Empty } from "@/components/ui";
import { formatInr } from "@/lib/format";
import { billsForSupplier } from "@/lib/input";
import { totalsOf } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { suppliers, purchases, deleteSupplier } = useRegistry();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const supplier = useMemo(
    () => suppliers.find((row) => row.id === params.id) ?? null,
    [params.id, suppliers],
  );
  const bills = useMemo(
    () => (supplier ? billsForSupplier(purchases, supplier) : []),
    [purchases, supplier],
  );
  const totals = useMemo(() => totalsOf(bills), [bills]);

  async function remove() {
    if (!supplier) return;
    setBusy(true);
    setConfirmDelete(false);
    try {
      await deleteSupplier(supplier.id);
      router.push("/suppliers");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not delete this party.");
      setBusy(false);
    }
  }

  if (!supplier) {
    return (
      <p className="text-[15px] text-muted">
        Party not found.{" "}
        <Link href="/suppliers" className="font-medium text-ink">
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
        <SupplierForm supplier={supplier} onSaved={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[20px] font-semibold tracking-tight">{supplier.name}</p>
        <p className="mt-1 text-[13px] text-muted">{supplier.gstin || "No GSTIN"}</p>
        {supplier.phone ? <p className="text-[13px] text-muted">{supplier.phone}</p> : null}
        {supplier.notes ? <p className="mt-2 text-[13px] text-muted">{supplier.notes}</p> : null}
      </div>

      <p className="tabular text-[13px] text-muted">
        {totals.count} {totals.count === 1 ? "bill" : "bills"}
        <span className="mx-1.5 text-line">·</span>
        GST {formatInr(totals.gst)}
      </p>

      <div className="flex gap-2">
        <Link
          href={`/purchases/new?supplier=${supplier.id}`}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-teal-800 px-4 text-[14px] font-medium text-white active:opacity-80 dark:bg-teal-400 dark:text-teal-950"
        >
          Add bill
        </Link>
        <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>
          Edit
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
          Delete
        </Button>
      </div>
      {hint ? <Alert tone="danger">{hint}</Alert> : null}

      {bills.length === 0 ? (
        <Empty title="No bills yet" hint="Add a bill for this party from here or the Add tab." />
      ) : (
        <PurchaseList>
          {bills.map((row) => (
            <PurchaseCard key={row.id} purchase={row} />
          ))}
        </PurchaseList>
      )}
      <Confirm
        open={confirmDelete}
        title="Delete this party?"
        body="Bills stay in the register."
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
