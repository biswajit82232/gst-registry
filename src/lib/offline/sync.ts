import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePurchase } from "@/lib/gst";
import { isMissingTable, normalizeSupplier } from "@/lib/suppliers";
import type { Profile, Purchase, Supplier } from "@/lib/types";
import type { GstDB, LocalPurchase, LocalSupplier } from "./db";

export const SYNC_MS = 30_000;
export const FULL_PULL_MS = 5 * 60_000;
const PAGE = 1000;

function maxUpdated(rows: Array<{ updated_at?: string | null }>): string | null {
  let max = "";
  for (const row of rows) {
    const at = row.updated_at;
    if (at && at > max) max = at;
  }
  return max || null;
}

function isInputStatusSchemaError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("input_status") || msg.includes("input_on") || msg.includes("pgrst204");
}

async function fetchPaged<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function pullAll(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  purchases: Purchase[];
  suppliers: Supplier[];
  profile: Profile | null;
  missingSuppliersTable: boolean;
}> {
  const [purchaseRows, profileRes] = await Promise.all([
    fetchPaged(async (from, to) => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);

  let missingSuppliersTable = false;
  let suppliers: Supplier[] = [];
  try {
    const supplierRows = await fetchPaged(async (from, to) => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    });
    suppliers = supplierRows.map((row) => normalizeSupplier(row as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (isMissingTable({ message })) missingSuppliersTable = true;
    else throw err;
  }

  return {
    purchases: purchaseRows.map((row) => normalizePurchase(row as Record<string, unknown>)),
    suppliers,
    profile: (profileRes.data as Profile | null) ?? null,
    missingSuppliersTable,
  };
}

export async function pullUpdated(
  supabase: SupabaseClient,
  userId: string,
  since: string,
): Promise<{
  purchases: Purchase[];
  suppliers: Supplier[];
  profile: Profile | null;
  missingSuppliersTable: boolean;
}> {
  const [purchaseRows, profileRes] = await Promise.all([
    fetchPaged(async (from, to) => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", since)
        .order("updated_at", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);

  let missingSuppliersTable = false;
  let suppliers: Supplier[] = [];
  try {
    const supplierRows = await fetchPaged(async (from, to) => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", since)
        .order("updated_at", { ascending: true })
        .range(from, to);
      return { data, error };
    });
    suppliers = supplierRows.map((row) => normalizeSupplier(row as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (isMissingTable({ message })) missingSuppliersTable = true;
    else throw err;
  }

  return {
    purchases: purchaseRows.map((row) => normalizePurchase(row as Record<string, unknown>)),
    suppliers,
    profile: (profileRes.data as Profile | null) ?? null,
    missingSuppliersTable,
  };
}

export async function mergePull(
  db: GstDB,
  remote: Awaited<ReturnType<typeof pullAll>>,
): Promise<void> {
  const localPurchases = await db.purchases.toArray();
  const localById = new Map(localPurchases.map((row) => [row.id, row]));
  const remoteIds = new Set(remote.purchases.map((row) => row.id));

  const purchasePuts: LocalPurchase[] = [];
  for (const row of remote.purchases) {
    const local = localById.get(row.id);
    if (local?.dirty) continue;
    purchasePuts.push({ ...row, dirty: 0, deleted: 0 });
  }
  if (purchasePuts.length) await db.purchases.bulkPut(purchasePuts);
  await Promise.all(
    localPurchases
      .filter((row) => !row.dirty && !remoteIds.has(row.id))
      .map((row) => db.purchases.delete(row.id)),
  );

  if (!remote.missingSuppliersTable) {
    const localSuppliers = await db.suppliers.toArray();
    const supplierById = new Map(localSuppliers.map((row) => [row.id, row]));
    const remoteSupplierIds = new Set(remote.suppliers.map((row) => row.id));
    const supplierPuts: LocalSupplier[] = [];
    for (const row of remote.suppliers) {
      const local = supplierById.get(row.id);
      if (local?.dirty) continue;
      supplierPuts.push({ ...row, dirty: 0, deleted: 0 });
    }
    if (supplierPuts.length) await db.suppliers.bulkPut(supplierPuts);
    await Promise.all(
      localSuppliers
        .filter((row) => !row.dirty && !remoteSupplierIds.has(row.id))
        .map((row) => db.suppliers.delete(row.id)),
    );
  }

  if (remote.profile) {
    const local = await db.profile.get(remote.profile.id);
    if (!local?.dirty) {
      await db.profile.put({ ...remote.profile, dirty: 0 });
    }
  }

  await db.meta.put({ key: "seeded", value: "1" });
  await db.meta.put({ key: "lastSync", value: String(Date.now()) });
  await db.meta.put({
    key: "missingSuppliers",
    value: remote.missingSuppliersTable ? "1" : "0",
  });
}

export async function mergeIncremental(
  db: GstDB,
  remote: Awaited<ReturnType<typeof pullUpdated>>,
): Promise<boolean> {
  let changed = false;
  const localPurchases = remote.purchases.length
    ? await db.purchases.bulkGet(remote.purchases.map((row) => row.id))
    : [];
  const purchasePuts: LocalPurchase[] = [];
  remote.purchases.forEach((row, i) => {
    const local = localPurchases[i];
    if (local?.dirty) return;
    if (local && local.updated_at === row.updated_at && local.deleted === 0) return;
    purchasePuts.push({ ...row, dirty: 0, deleted: 0 });
  });
  if (purchasePuts.length) {
    await db.purchases.bulkPut(purchasePuts);
    changed = true;
  }

  if (!remote.missingSuppliersTable && remote.suppliers.length) {
    const localSuppliers = await db.suppliers.bulkGet(remote.suppliers.map((row) => row.id));
    const supplierPuts: LocalSupplier[] = [];
    remote.suppliers.forEach((row, i) => {
      const local = localSuppliers[i];
      if (local?.dirty) return;
      if (local && local.updated_at === row.updated_at && local.deleted === 0) return;
      supplierPuts.push({ ...row, dirty: 0, deleted: 0 });
    });
    if (supplierPuts.length) {
      await db.suppliers.bulkPut(supplierPuts);
      changed = true;
    }
  }

  if (remote.profile) {
    const local = await db.profile.get(remote.profile.id);
    if (!local?.dirty) {
      const same =
        local &&
        local.business_name === remote.profile.business_name &&
        local.gstin === remote.profile.gstin &&
        local.email === remote.profile.email;
      if (!same) {
        await db.profile.put({ ...remote.profile, dirty: 0 });
        changed = true;
      }
    }
  }

  await db.meta.put({ key: "lastSync", value: String(Date.now()) });
  await db.meta.put({
    key: "missingSuppliers",
    value: remote.missingSuppliersTable ? "1" : "0",
  });
  return changed;
}

function purchasePayload(row: LocalPurchase): Record<string, unknown> {
  const { dirty, deleted, ...rest } = row;
  void dirty;
  void deleted;
  return rest;
}

function supplierPayload(row: LocalSupplier): Record<string, unknown> {
  const { dirty, deleted, ...rest } = row;
  void dirty;
  void deleted;
  return rest;
}

async function upsertPurchase(
  supabase: SupabaseClient,
  row: LocalPurchase,
): Promise<{ error: string | null }> {
  const payload = purchasePayload(row);
  let { error } = await supabase.from("purchases").upsert(payload, { onConflict: "id" });
  if (error && isInputStatusSchemaError(error.message)) {
    const { input_status, input_on, ...rest } = payload;
    void input_status;
    void input_on;
    ({ error } = await supabase.from("purchases").upsert(rest, { onConflict: "id" }));
    if (!error) {
      return {
        error: "Run supabase/input-status.sql once in the Supabase SQL editor, then try again.",
      };
    }
  }
  return { error: error?.message ?? null };
}

export async function pushDirty(
  db: GstDB,
  supabase: SupabaseClient,
): Promise<{ error: string | null; missingSuppliersTable: boolean; wrote: boolean }> {
  let hint: string | null = null;
  let wrote = false;
  let missingSuppliersTable = (await db.meta.get("missingSuppliers"))?.value === "1";

  const dirtySuppliers = await db.suppliers.where("dirty").equals(1).toArray();
  if (!missingSuppliersTable) {
    for (const row of dirtySuppliers) {
      if (row.deleted) {
        const { error } = await supabase.from("suppliers").delete().eq("id", row.id);
        if (error) {
          if (isMissingTable(error)) {
            missingSuppliersTable = true;
            break;
          }
          return { error: error.message, missingSuppliersTable, wrote };
        }
        await db.suppliers.delete(row.id);
        wrote = true;
        continue;
      }
      const { error } = await supabase
        .from("suppliers")
        .upsert(supplierPayload(row), { onConflict: "id" });
      if (error) {
        if (isMissingTable(error)) {
          missingSuppliersTable = true;
          break;
        }
        return { error: error.message, missingSuppliersTable, wrote };
      }
      await db.suppliers.update(row.id, { dirty: 0 });
      wrote = true;
    }
  }
  if (missingSuppliersTable) {
    await db.meta.put({ key: "missingSuppliers", value: "1" });
  }

  const dirtyPurchases = await db.purchases.where("dirty").equals(1).toArray();
  for (const row of dirtyPurchases) {
    if (row.deleted) {
      const { error } = await supabase.from("purchases").delete().eq("id", row.id);
      if (error) return { error: error.message, missingSuppliersTable, wrote };
      await db.purchases.delete(row.id);
      wrote = true;
      continue;
    }
    const result = await upsertPurchase(supabase, row);
    if (result.error?.includes("input-status.sql")) {
      hint = result.error;
      continue;
    }
    if (result.error) return { error: result.error, missingSuppliersTable, wrote };
    await db.purchases.update(row.id, { dirty: 0 });
    wrote = true;
  }

  const dirtyProfiles = (await db.profile.toArray()).filter((row) => row.dirty);
  for (const row of dirtyProfiles) {
    const { dirty, ...payload } = row;
    void dirty;
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) return { error: error.message, missingSuppliersTable, wrote };
    await db.profile.update(row.id, { dirty: 0 });
    wrote = true;
  }

  return { error: hint, missingSuppliersTable, wrote };
}

export async function runSync(
  db: GstDB,
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null; missingSuppliersTable: boolean; changed: boolean }> {
  const pushed = await pushDirty(db, supabase);
  const seeded = (await db.meta.get("seeded"))?.value === "1";
  const lastFull = Number((await db.meta.get("lastFullPull"))?.value || 0);
  const lastRemoteAt = (await db.meta.get("lastRemoteAt"))?.value ?? null;
  const needFull = !seeded || !lastRemoteAt || Date.now() - lastFull > FULL_PULL_MS;

  if (needFull) {
    const remote = await pullAll(supabase, userId);
    await mergePull(db, remote);
    const watermark = maxUpdated([...remote.purchases, ...remote.suppliers]) ?? nowIso();
    await db.meta.put({ key: "lastFullPull", value: String(Date.now()) });
    await db.meta.put({ key: "lastRemoteAt", value: watermark });
    return {
      error: pushed.error,
      missingSuppliersTable: remote.missingSuppliersTable || pushed.missingSuppliersTable,
      changed: true,
    };
  }

  const remote = await pullUpdated(supabase, userId, lastRemoteAt);
  const merged = await mergeIncremental(db, remote);
  const watermark = maxUpdated([...remote.purchases, ...remote.suppliers]);
  if (watermark && watermark > lastRemoteAt) {
    await db.meta.put({ key: "lastRemoteAt", value: watermark });
  }
  return {
    error: pushed.error,
    missingSuppliersTable: remote.missingSuppliersTable || pushed.missingSuppliersTable,
    changed: pushed.wrote || merged,
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function purchaseFromInput(
  userId: string,
  input: Omit<Purchase, "id" | "user_id" | "created_at" | "updated_at"> &
    Partial<Pick<Purchase, "id" | "created_at">>,
  existing?: Purchase,
): Purchase {
  const now = nowIso();
  return {
    id: existing?.id ?? input.id ?? newId(),
    user_id: userId,
    invoice_date: input.invoice_date,
    invoice_number: input.invoice_number.trim(),
    supplier_name: input.supplier_name.trim(),
    supplier_gstin: input.supplier_gstin?.trim().toUpperCase() || null,
    purchased_by: input.purchased_by?.trim() || null,
    category: input.category,
    hsn_sac: input.hsn_sac?.trim() || null,
    taxable_value: input.taxable_value,
    gst_rate: input.gst_rate,
    tax_type: input.tax_type,
    cgst: input.cgst,
    sgst: input.sgst,
    igst: input.igst,
    cess: input.cess,
    invoice_total: input.invoice_total,
    itc_eligible: input.itc_eligible,
    reverse_charge: input.reverse_charge,
    payment_status: input.payment_status,
    payment_date:
      input.payment_status === "paid" ? input.payment_date || input.invoice_date : null,
    place_of_supply: input.place_of_supply?.trim() || null,
    notes: input.notes?.trim() || null,
    supplier_id: input.supplier_id || null,
    input_status: input.input_status ?? "waiting",
    input_on: input.input_on ?? null,
    created_at: existing?.created_at ?? input.created_at ?? now,
    updated_at: now,
  };
}

export function findLocalSupplier(
  rows: Supplier[],
  input: { name: string; gstin?: string | null; id?: string },
): Supplier | undefined {
  const gstin = input.gstin?.trim().toUpperCase() || null;
  if (gstin) {
    const byGstin = rows.find((row) => row.gstin === gstin);
    if (byGstin) return byGstin;
  }
  if (input.id) {
    const byId = rows.find((row) => row.id === input.id);
    if (byId) return byId;
  }
  const name = input.name.trim().toLowerCase();
  return rows.find((row) => row.name.toLowerCase() === name);
}
