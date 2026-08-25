"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { PurchaseCard, PurchaseList, ShowMore } from "@/components/purchase-card";
import { SupplierForm } from "@/components/supplier-form";
import { Button, Empty, StatStrip } from "@/components/ui";
import { useWindowed } from "@/components/use-windowed";
import { formatCompact } from "@/lib/format";
import { gstinState, totalsOf } from "@/lib/gst";
import { billsForSupplier, supplierReliability } from "@/lib/input";
import { useRegistry } from "@/lib/offline/registry";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { suppliers, purchases, markInput, deleteSupplier } = useRegistry();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const supplier = useMemo(
    () => suppliers.find((row) => row.id === params.id) ?? null,
    [suppliers, params.id],
  );
  const bills = useMemo(
    () => (supplier ? billsForSupplier(purchases, supplier) : []),
    [purchases, supplier],
  );
  const windowed = useWindowed(bills, `${params.id}:${bills.length}`);
  const totals = useMemo(() => totalsOf(bills), [bills]);
  const score = useMemo(() => supplierReliability(bills), [bills]);

  async function remove() {
    if (!supplier || !confirm("Delete this supplier? Bills stay unlinked.")) return;
    setBusy(true);
    try {
      await deleteSupplier(supplier.id);
      router.push("/suppliers");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete this supplier.");
      setBusy(false);
    }
  }

  if (!supplier) {
    return (
      <p className="text-[12px] text-muted">
        Not found.{" "}
        <Link href="/suppliers" className="text-teal-700 dark:text-teal-300">
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
        <SupplierForm supplier={supplier} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[16px] font-semibold leading-tight">{supplier.name}</p>
        <p className="text-[11px] text-muted">
          {supplier.gstin || "No GSTIN"}
          {supplier.gstin ? ` · ${gstinState(supplier.gstin) || ""}` : ""}
          {supplier.phone ? ` · ${supplier.phone}` : ""}
        </p>
        {supplier.notes ? <p className="mt-0.5 text-[11px] text-muted">{supplier.notes}</p> : null}
        <p className="mt-0.5 text-[11px] font-medium">{score.label}</p>
      </div>

      <StatStrip
        items={[
          { label: "Got", value: formatCompact(score.gotGst) },
          { label: "Wait", value: formatCompact(score.waitingGst), accent: score.waitingGst > 0 },
          { label: "GST", value: formatCompact(totals.gst) },
        ]}
      />

      <div className="flex gap-1">
        <Link
          href={`/purchases/new?supplier=${supplier.id}`}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-teal-700 px-2 text-[12px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
        >
          <Plus className="h-3.5 w-3.5" />
          Bill
        </Link>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label="Edit supplier">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={bills.length === 0}
          aria-label="Download PDF"
          onClick={async () => {
            const { downloadPurchasePdf } = await import("@/lib/pdf");
            downloadPurchasePdf(bills, {
              profile: {
                id: "",
                business_name: supplier.name,
                gstin: supplier.gstin,
                state_code: null,
                email: null,
              },
              periodLabel: supplier.name,
            });
          }}
        >
          <Printer className="h-3.5 w-3.5" />
        </Button>
        <Button variant="danger" size="sm" onClick={remove} disabled={busy} aria-label="Delete supplier">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {bills.length === 0 ? (
        <Empty title="No bills yet" hint="Add a bill from this party." />
      ) : (
        <PurchaseList>
          {windowed.visible.map((bill) => (
            <PurchaseCard
              key={bill.id}
              purchase={bill}
              onGotInput={
                bill.input_status === "waiting" ? (id) => void markInput(id, "got") : undefined
              }
            />
          ))}
          <ShowMore remaining={windowed.remaining} onClick={windowed.showMore} />
        </PurchaseList>
      )}
    </div>
  );
}
