import type { SupabaseClient } from "@supabase/supabase-js";
import type { Supplier } from "./types";

export function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist")
  );
}

export function normalizeSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name ?? ""),
    gstin: row.gstin ? String(row.gstin) : null,
    phone: row.phone ? String(row.phone) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listSuppliers(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ rows: Supplier[]; missingTable: boolean }> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) {
    if (isMissingTable(error)) return { rows: [], missingTable: true };
    throw error;
  }
  return { rows: (data ?? []).map((row) => normalizeSupplier(row)), missingTable: false };
}

export async function upsertSupplier(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; gstin?: string | null; phone?: string | null; notes?: string | null },
): Promise<Supplier | null> {
  const name = input.name.trim();
  const gstin = input.gstin?.trim().toUpperCase() || null;
  if (!name) return null;

  let existing: Record<string, unknown> | null = null;
  if (gstin) {
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .eq("user_id", userId)
      .eq("gstin", gstin)
      .maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", name.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_"))
      .limit(1);
    existing = data?.[0] ?? null;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("suppliers")
      .update({
        name,
        gstin: gstin || existing.gstin || null,
        phone: input.phone !== undefined ? input.phone || null : existing.phone,
        notes: input.notes !== undefined ? input.notes || null : existing.notes,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (!error && data) return normalizeSupplier(data);
    if (error && isMissingTable(error)) return null;
    if (gstin) {
      const { data: byGstin } = await supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", userId)
        .eq("gstin", gstin)
        .maybeSingle();
      if (byGstin) return normalizeSupplier(byGstin);
    }
    if (error) throw error;
    return data ? normalizeSupplier(data) : null;
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      user_id: userId,
      name,
      gstin,
      phone: input.phone || null,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return normalizeSupplier(data);
}
