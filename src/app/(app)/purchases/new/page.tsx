"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PurchaseForm } from "@/components/purchase-form";
import { useRegistry } from "@/lib/offline/registry";

export default function NewPurchasePage() {
  return (
    <Suspense>
      <NewPurchaseInner />
    </Suspense>
  );
}

function NewPurchaseInner() {
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("supplier");
  const { profile, suppliers } = useRegistry();
  const supplier = supplierId ? suppliers.find((row) => row.id === supplierId) ?? null : null;

  return (
    <div>
      <PurchaseForm profile={profile} initialSupplier={supplier} />
    </div>
  );
}
