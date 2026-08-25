"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PurchaseForm } from "@/components/purchase-form";
import { useRegistry } from "@/lib/offline/registry";

function NewBill() {
  const params = useSearchParams();
  const { profile } = useRegistry();
  return <PurchaseForm profile={profile} supplierId={params.get("supplier")} />;
}

export default function NewPurchasePage() {
  return (
    <Suspense fallback={<div className="h-24 rounded-md bg-line/40" aria-hidden="true" />}>
      <NewBill />
    </Suspense>
  );
}
