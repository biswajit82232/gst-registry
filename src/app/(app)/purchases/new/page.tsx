"use client";

import { PurchaseForm } from "@/components/purchase-form";
import { useRegistry } from "@/lib/offline/registry";

export default function NewPurchasePage() {
  const { profile } = useRegistry();
  return <PurchaseForm profile={profile} />;
}
