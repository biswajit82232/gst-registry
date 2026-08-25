import type { InputStatus, Purchase, Supplier } from "./types";
import { todayIso } from "./format";
import { toNumber } from "./gst";
import type { SupabaseClient } from "@supabase/supabase-js";

export function gstOf(row: Purchase): number {
  return toNumber(row.cgst) + toNumber(row.sgst) + toNumber(row.igst);
}

export function parseInputStatus(value: unknown): InputStatus {
  const s = String(value ?? "").toLowerCase();
  if (s === "got" || s === "yes" || s === "received" || s === "got_input") return "got";
  if (s === "missing" || s === "no" || s === "not_received") return "missing";
  return "waiting";
}

export function inputLabel(status: InputStatus): string {
  if (status === "got") return "Got input";
  if (status === "missing") return "Not received";
  return "Waiting";
}

export function isClaimable(row: Purchase): boolean {
  return row.itc_eligible && gstOf(row) > 0;
}

export function billsForSupplier(purchases: Purchase[], supplier: Supplier): Purchase[] {
  return purchases
    .filter((row) => {
      if (row.supplier_id === supplier.id) return true;
      if (supplier.gstin && row.supplier_gstin === supplier.gstin) return true;
      if (
        !row.supplier_id &&
        row.supplier_name.toLowerCase() === supplier.name.toLowerCase()
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
}

export async function setInputStatus(
  supabase: SupabaseClient,
  id: string,
  input_status: InputStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("purchases")
    .update({
      input_status,
      input_on: input_status === "waiting" ? null : todayIso(),
    })
    .eq("id", id);
  if (!error) return { error: null };
  const msg = error.message || "";
  if (msg.toLowerCase().includes("input_status") || msg.includes("PGRST204")) {
    return {
      error: "Run supabase/input-status.sql once in the Supabase SQL editor, then try again.",
    };
  }
  return { error: msg };
}

export async function setManyInputStatus(
  supabase: SupabaseClient,
  ids: string[],
  input_status: InputStatus,
): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase
    .from("purchases")
    .update({
      input_status,
      input_on: input_status === "waiting" ? null : todayIso(),
    })
    .in("id", ids);
  if (!error) return { error: null };
  const msg = error.message || "";
  if (msg.toLowerCase().includes("input_status") || msg.includes("PGRST204")) {
    return {
      error: "Run supabase/input-status.sql once in the Supabase SQL editor, then try again.",
    };
  }
  return { error: msg };
}

export function supplierReliability(rows: Purchase[]): {
  eligible: number;
  got: number;
  waiting: number;
  missing: number;
  gotGst: number;
  waitingGst: number;
  label: string;
} {
  const claimable = rows.filter(isClaimable);
  const got = claimable.filter((r) => r.input_status === "got");
  const waiting = claimable.filter((r) => r.input_status === "waiting");
  const missing = claimable.filter((r) => r.input_status === "missing");
  const decided = got.length + missing.length;
  let label = "Not reconciled yet";
  if (decided > 0) {
    const ratio = got.length / decided;
    if (missing.length > 0 && ratio < 0.4) label = "Often not passing ITC";
    else if (ratio >= 0.8) label = "Usually gives input";
    else label = "Mixed";
  }
  return {
    eligible: claimable.length,
    got: got.length,
    waiting: waiting.length,
    missing: missing.length,
    gotGst: got.reduce((s, r) => s + gstOf(r), 0),
    waitingGst: waiting.reduce((s, r) => s + gstOf(r), 0),
    label,
  };
}
