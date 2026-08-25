"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PurchaseCard, PurchaseList } from "@/components/purchase-card";
import { SupplierForm } from "@/components/supplier-form";
import { Button, Empty } from "@/components/ui";
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
    if (!supplier || !confirm("Delete this party? Bills stay in the register.")) return;
    setBusy(true);
    try {
      await deleteSupplier(supplier.id);
      router.push("/suppliers");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete this party.");
      setBusy(false);
    }
  }

  if (!supplier) {
    return (
      <p className="text-[13px] text-muted">
        Party not found.{" "}
        <Link href="/suppliers" className="text-teal-700 dark:text-teal-300">
          Back
        </Link>
      </p>
    );
  }

  if (editing) {
    return (
      <div>
        <button type="button" className="mb-2 min-h-10 text-[13px] text-muted" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <SupplierForm supplier={supplier} onSaved={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[17px] font-semibold leading-tight">{supplier.name}</p>
        <p className="mt-0.5 text-[12px] text-muted">{supplier.gstin || "No GSTIN"}</p>
        {supplier.phone ? <p className="text-[12px] text-muted">{supplier.phone}</p> : null}
        {supplier.notes ? <p className="mt-1 text-[12px] text-muted">{supplier.notes}</p> : null}
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-line bg-bg-elev">
        <div className="px-2.5 py-2">
          <p className="text-[10px] text-muted">Bills</p>
          <p className="tabular text-[15px] font-semibold">{totals.count}</p>
        </div>
        <div className="border-l border-line px-2.5 py-2">
          <p className="text-[10px] text-muted">GST</p>
          <p className="tabular text-[15px] font-semibold">{formatInr(totals.gst)}</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        <Link
          href={`/purchases/new?supplier=${supplier.id}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-teal-700 px-3 text-[13px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
        >
          Add bill
        </Link>
        <Button className="min-h-11" variant="outline" onClick={() => setEditing(true)} disabled={busy}>
          Edit
        </Button>
        <Button variant="danger" className="min-h-11" onClick={remove} disabled={busy}>
          Delete
        </Button>
      </div>

      {bills.length === 0 ? (
        <Empty title="No bills yet" hint="Add a bill for this party from here or the Add tab." />
      ) : (
        <PurchaseList>
          {bills.map((row) => (
            <PurchaseCard key={row.id} purchase={row} />
          ))}
        </PurchaseList>
      )}
    </div>
  );
}
