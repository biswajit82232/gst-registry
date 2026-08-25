import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeLines, normalizePurchase } from "@/lib/gst";
import { isMissingTable, normalizeSupplier } from "@/lib/suppliers";
import type { Profile, Purchase, Supplier } from "@/lib/types";
import type { GstDB, LocalPurchase, LocalSupplier } from "./db";

export const SYNC_MS = 30_000;
export const FULL_PULL_MS = 5 * 60_000;
export const WRITE_DEBOUNCE_MS = 450;
const PAGE = 1000;
const UPSERT_CHUNK = 50;
const SCHEMA_HINT =
  "Run pending Supabase migrations (`npx supabase db push`), then try again.";

function maxUpdated(rows: Array<{ updated_at?: string | null }>): string | null {
  let max = "";
  for (const row of rows) {
    const at = row.updated_at;
    if (at && at > max) max = at;
  }
  return max || null;
}

export function isInputStatusSchemaError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("input_status") || msg.includes("input_on");
}

export function isLinesSchemaError(message: string): boolean {
  return /\blines\b/i.test(message);
}

export function isClockSkewError(message: string): boolean {
  const m = message.toLowerCase();
  if (!/future|used before issued|not yet valid|not valid yet/.test(m)) return false;
  return /jwt|token|claim|iat|nbf|jws|session|auth/.test(m);
}

export function isTransientError(message: string): boolean {
  if (isClockSkewError(message)) return true;
  const m = message.toLowerCase();
  return (
    /failed to fetch|networkerror|network request|load failed|offline|fetch failed|timeout|timed out|abort|econnreset|enotfound|socket/.test(
      m,
    ) || /\b(408|425|429|500|502|503|504)\b/.test(m)
  );
}

export function isAuthError(message: string): boolean {
  if (isClockSkewError(message)) return false;
  const m = message.toLowerCase();
  return (
    /jwt|not authenticated|unauthori[sz]ed|invalid claim|refresh token|session/.test(m) ||
    /\b401\b/.test(m)
  );
}

export function publicSyncError(message: string | null): string | null {
  if (!message) return null;
  if (isClockSkewError(message) || isAuthError(message)) return null;
  return message;
}

export type ReconcileRow = { id: string; dirty: number; deleted: number };

export function parseSeenIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function planIdReconcile(
  local: ReconcileRow[],
  remoteIds: Iterable<string>,
  opts: { remoteComplete: boolean; seenIds: Iterable<string> },
): { dropIds: string[]; nextSeen: string[] } {
  const remote = new Set(remoteIds);
  const seen = new Set(opts.seenIds);
  if (!opts.remoteComplete) {
    return { dropIds: [], nextSeen: [...seen] };
  }
  const dropIds: string[] = [];
  for (const row of local) {
    if (remote.has(row.id)) continue;
    if (row.deleted || !row.dirty || seen.has(row.id)) {
      dropIds.push(row.id);
    }
  }
  return { dropIds, nextSeen: [...remote] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPaged<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    let rows: T[] | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await run(from, from + PAGE - 1);
      if (!error) {
        rows = data ?? [];
        break;
      }
      if (!isTransientError(error.message) || attempt === 2) {
        throw new Error(error.message);
      }
      await sleep(isClockSkewError(error.message) ? 1200 : 400 * 2 ** attempt);
    }
    const page = rows ?? [];
    all.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function pullRemoteIds(
  supabase: SupabaseClient,
  table: "purchases" | "suppliers",
  userId: string,
): Promise<{ ids: string[]; complete: boolean; missingTable: boolean }> {
  try {
    const rows = await fetchPaged<{ id: string }>(async (from, to) => {
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    });
    return {
      ids: rows.map((row) => row.id).filter(Boolean),
      complete: true,
      missingTable: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (table === "suppliers" && isMissingTable({ message })) {
      return { ids: [], complete: false, missingTable: true };
    }
    return { ids: [], complete: false, missingTable: false };
  }
}

async function applyIdReconcile(
  db: GstDB,
  table: "purchases" | "suppliers",
  userId: string,
  supabase: SupabaseClient,
): Promise<{ changed: boolean; missingTable: boolean }> {
  const fetched = await pullRemoteIds(supabase, table, userId);
  if (!fetched.complete) return { changed: false, missingTable: fetched.missingTable };
  const metaKey = table === "purchases" ? "seenPurchaseIds" : "seenSupplierIds";
  const seen = parseSeenIds((await db.meta.get(metaKey))?.value);
  const local =
    table === "purchases" ? await db.purchases.toArray() : await db.suppliers.toArray();
  const plan = planIdReconcile(local, fetched.ids, { remoteComplete: true, seenIds: seen });
  if (plan.dropIds.length) {
    if (table === "purchases") await db.purchases.bulkDelete(plan.dropIds);
    else await db.suppliers.bulkDelete(plan.dropIds);
  }
  await db.meta.put({ key: metaKey, value: JSON.stringify(plan.nextSeen) });
  return { changed: plan.dropIds.length > 0, missingTable: fetched.missingTable };
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
        .gte("updated_at", since)
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
        .gte("updated_at", since)
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
): Promise<boolean> {
  return db.transaction("rw", db.purchases, db.suppliers, db.profile, db.meta, async () => {
    let changed = false;
    const localPurchases = await db.purchases.toArray();
    const localById = new Map(localPurchases.map((row) => [row.id, row]));
    const remoteIds = new Set(remote.purchases.map((row) => row.id));

    const purchasePuts: LocalPurchase[] = [];
    for (const row of remote.purchases) {
      const local = localById.get(row.id);
      if (local?.dirty) continue;
      if (local && local.updated_at === row.updated_at && local.deleted === 0) continue;
      purchasePuts.push({ ...row, dirty: 0, deleted: 0 });
    }
    if (purchasePuts.length) {
      await db.purchases.bulkPut(purchasePuts);
      changed = true;
    }
    const purchaseDeletes = localPurchases
      .filter((row) => !row.dirty && !remoteIds.has(row.id))
      .map((row) => row.id);
    if (purchaseDeletes.length) {
      await db.purchases.bulkDelete(purchaseDeletes);
      changed = true;
    }

    if (!remote.missingSuppliersTable) {
      const localSuppliers = await db.suppliers.toArray();
      const supplierById = new Map(localSuppliers.map((row) => [row.id, row]));
      const remoteSupplierIds = new Set(remote.suppliers.map((row) => row.id));
      const supplierPuts: LocalSupplier[] = [];
      for (const row of remote.suppliers) {
        const local = supplierById.get(row.id);
        if (local?.dirty) continue;
        if (local && local.updated_at === row.updated_at && local.deleted === 0) continue;
        supplierPuts.push({ ...row, dirty: 0, deleted: 0 });
      }
      if (supplierPuts.length) {
        await db.suppliers.bulkPut(supplierPuts);
        changed = true;
      }
      const supplierDeletes = localSuppliers
        .filter((row) => !row.dirty && !remoteSupplierIds.has(row.id))
        .map((row) => row.id);
      if (supplierDeletes.length) {
        await db.suppliers.bulkDelete(supplierDeletes);
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

    await db.meta.put({ key: "seeded", value: "1" });
    await db.meta.put({ key: "lastSync", value: String(Date.now()) });
    await db.meta.put({
      key: "missingSuppliers",
      value: remote.missingSuppliersTable ? "1" : "0",
    });
    return changed;
  });
}

export async function mergeIncremental(
  db: GstDB,
  remote: Awaited<ReturnType<typeof pullUpdated>>,
): Promise<boolean> {
  return db.transaction("rw", db.purchases, db.suppliers, db.profile, db.meta, async () => {
    let changed = false;
    if (remote.purchases.length) {
      const localPurchases = await db.purchases.bulkGet(remote.purchases.map((row) => row.id));
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
  });
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

async function clearPurchaseDirty(db: GstDB, rows: LocalPurchase[]): Promise<void> {
  if (!rows.length) return;
  await db.transaction("rw", db.purchases, async () => {
    for (const row of rows) {
      const current = await db.purchases.get(row.id);
      if (current && current.updated_at === row.updated_at && current.dirty) {
        await db.purchases.update(row.id, { dirty: 0 });
      }
    }
  });
}

async function clearSupplierDirty(db: GstDB, rows: LocalSupplier[]): Promise<void> {
  if (!rows.length) return;
  await db.transaction("rw", db.suppliers, async () => {
    for (const row of rows) {
      const current = await db.suppliers.get(row.id);
      if (current && current.updated_at === row.updated_at && current.dirty) {
        await db.suppliers.update(row.id, { dirty: 0 });
      }
    }
  });
}

async function removeIfStillDeleted(
  table: GstDB["purchases"] | GstDB["suppliers"],
  id: string,
): Promise<boolean> {
  const current = await table.get(id);
  if (current?.deleted) {
    await table.delete(id);
    return true;
  }
  return false;
}

function stripPurchaseSchema(payload: Record<string, unknown>, message: string): Record<string, unknown> | null {
  if (isLinesSchemaError(message) && "lines" in payload) {
    const { lines, ...rest } = payload;
    void lines;
    return rest;
  }
  if (isInputStatusSchemaError(message)) {
    const { input_status, input_on, ...rest } = payload;
    void input_status;
    void input_on;
    return rest;
  }
  return null;
}

async function upsertPurchase(
  supabase: SupabaseClient,
  row: LocalPurchase,
): Promise<{ error: string | null }> {
  let payload = purchasePayload(row);
  let { error } = await supabase.from("purchases").upsert(payload, { onConflict: "id" });
  while (error) {
    const stripped = stripPurchaseSchema(payload, error.message);
    if (!stripped) break;
    payload = stripped;
    ({ error } = await supabase.from("purchases").upsert(payload, { onConflict: "id" }));
    if (!error) return { error: SCHEMA_HINT };
  }
  return { error: error?.message ?? null };
}

async function upsertPurchaseChunk(
  supabase: SupabaseClient,
  db: GstDB,
  rows: LocalPurchase[],
): Promise<{ error: string | null; hint: string | null; wrote: boolean }> {
  if (!rows.length) return { error: null, hint: null, wrote: false };

  let payloads = rows.map(purchasePayload);
  let { error } = await supabase.from("purchases").upsert(payloads, { onConflict: "id" });
  while (error) {
    const stripped = payloads.map((payload) => stripPurchaseSchema(payload, error!.message) ?? payload);
    const changed = stripped.some((payload, i) => payload !== payloads[i]);
    if (!changed) break;
    payloads = stripped;
    ({ error } = await supabase.from("purchases").upsert(payloads, { onConflict: "id" }));
    if (!error) {
      await clearPurchaseDirty(db, rows);
      return { error: null, hint: SCHEMA_HINT, wrote: true };
    }
  }
  if (!error) {
    await clearPurchaseDirty(db, rows);
    return { error: null, hint: null, wrote: true };
  }
  if (rows.length === 1) return { error: error.message, hint: null, wrote: false };

  let hint: string | null = null;
  const ok: LocalPurchase[] = [];
  for (const row of rows) {
    const result = await upsertPurchase(supabase, row);
    if (result.error === SCHEMA_HINT) {
      hint = result.error;
      ok.push(row);
      continue;
    }
    if (result.error) {
      await clearPurchaseDirty(db, ok);
      return { error: result.error, hint, wrote: ok.length > 0 };
    }
    ok.push(row);
  }
  await clearPurchaseDirty(db, ok);
  return { error: null, hint, wrote: ok.length > 0 };
}

async function upsertSupplierChunk(
  supabase: SupabaseClient,
  db: GstDB,
  rows: LocalSupplier[],
): Promise<{ error: string | null; missingTable: boolean; wrote: boolean }> {
  if (!rows.length) return { error: null, missingTable: false, wrote: false };

  const { error } = await supabase
    .from("suppliers")
    .upsert(rows.map(supplierPayload), { onConflict: "id" });
  if (!error) {
    await clearSupplierDirty(db, rows);
    return { error: null, missingTable: false, wrote: true };
  }
  if (isMissingTable(error)) return { error: null, missingTable: true, wrote: false };
  if (rows.length === 1) return { error: error.message, missingTable: false, wrote: false };

  const ok: LocalSupplier[] = [];
  for (const row of rows) {
    const { error: rowError } = await supabase
      .from("suppliers")
      .upsert(supplierPayload(row), { onConflict: "id" });
    if (rowError) {
      if (isMissingTable(rowError)) {
        await clearSupplierDirty(db, ok);
        return { error: null, missingTable: true, wrote: ok.length > 0 };
      }
      await clearSupplierDirty(db, ok);
      return { error: rowError.message, missingTable: false, wrote: ok.length > 0 };
    }
    ok.push(row);
  }
  await clearSupplierDirty(db, ok);
  return { error: null, missingTable: false, wrote: ok.length > 0 };
}

async function deleteIds(
  supabase: SupabaseClient,
  table: "purchases" | "suppliers",
  ids: string[],
): Promise<{ error: string | null; missingTable: boolean }> {
  if (!ids.length) return { error: null, missingTable: false };
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (!error) return { error: null, missingTable: false };
  if (table === "suppliers" && isMissingTable(error)) {
    return { error: null, missingTable: true };
  }
  if (ids.length === 1) return { error: error.message, missingTable: false };
  for (const id of ids) {
    const { error: rowError } = await supabase.from(table).delete().eq("id", id);
    if (rowError) {
      if (table === "suppliers" && isMissingTable(rowError)) {
        return { error: null, missingTable: true };
      }
      return { error: rowError.message, missingTable: false };
    }
  }
  return { error: null, missingTable: false };
}

export async function pushDirty(
  db: GstDB,
  supabase: SupabaseClient,
  mode: "deletes" | "upserts" | "all" = "all",
): Promise<{ error: string | null; missingSuppliersTable: boolean; wrote: boolean }> {
  const doDeletes = mode === "deletes" || mode === "all";
  const doUpserts = mode === "upserts" || mode === "all";
  let hint: string | null = null;
  let wrote = false;
  let missingSuppliersTable = (await db.meta.get("missingSuppliers"))?.value === "1";

  const dirtySuppliers = await db.suppliers.where("dirty").equals(1).toArray();
  if (!missingSuppliersTable && dirtySuppliers.length) {
    const dead = dirtySuppliers.filter((row) => row.deleted);
    const live = dirtySuppliers.filter((row) => !row.deleted);

    if (doDeletes) {
      for (let i = 0; i < dead.length; i += UPSERT_CHUNK) {
        const chunk = dead.slice(i, i + UPSERT_CHUNK);
        const result = await deleteIds(
          supabase,
          "suppliers",
          chunk.map((row) => row.id),
        );
        if (result.missingTable) {
          missingSuppliersTable = true;
          break;
        }
        if (result.error) return { error: result.error, missingSuppliersTable, wrote };
        for (const row of chunk) {
          if (await removeIfStillDeleted(db.suppliers, row.id)) wrote = true;
        }
      }
    }

    if (doUpserts && !missingSuppliersTable) {
      for (let i = 0; i < live.length; i += UPSERT_CHUNK) {
        const chunk = live.slice(i, i + UPSERT_CHUNK);
        const result = await upsertSupplierChunk(supabase, db, chunk);
        if (result.missingTable) {
          missingSuppliersTable = true;
          break;
        }
        if (result.error) return { error: result.error, missingSuppliersTable, wrote };
        if (result.wrote) wrote = true;
      }
    }
  }
  if (missingSuppliersTable) {
    await db.meta.put({ key: "missingSuppliers", value: "1" });
  }

  const dirtyPurchases = await db.purchases.where("dirty").equals(1).toArray();
  const deadPurchases = dirtyPurchases.filter((row) => row.deleted);
  const livePurchases = dirtyPurchases.filter((row) => !row.deleted);

  if (doDeletes) {
    for (let i = 0; i < deadPurchases.length; i += UPSERT_CHUNK) {
      const chunk = deadPurchases.slice(i, i + UPSERT_CHUNK);
      const result = await deleteIds(
        supabase,
        "purchases",
        chunk.map((row) => row.id),
      );
      if (result.error) return { error: result.error, missingSuppliersTable, wrote };
      for (const row of chunk) {
        if (await removeIfStillDeleted(db.purchases, row.id)) wrote = true;
      }
    }
  }

  if (doUpserts) {
    for (let i = 0; i < livePurchases.length; i += UPSERT_CHUNK) {
      const chunk = livePurchases.slice(i, i + UPSERT_CHUNK);
      const result = await upsertPurchaseChunk(supabase, db, chunk);
      if (result.hint) hint = result.hint;
      if (result.error) return { error: result.error, missingSuppliersTable, wrote };
      if (result.wrote) wrote = true;
    }

    const dirtyProfiles = (await db.profile.toArray()).filter((row) => row.dirty);
    for (const row of dirtyProfiles) {
      const { dirty, ...payload } = row;
      void dirty;
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) return { error: error.message, missingSuppliersTable, wrote };
      const current = await db.profile.get(row.id);
      if (
        current?.dirty &&
        current.business_name === row.business_name &&
        current.gstin === row.gstin
      ) {
        await db.profile.update(row.id, { dirty: 0 });
        wrote = true;
      }
    }
  }

  return { error: hint, missingSuppliersTable, wrote };
}

export async function runSync(
  db: GstDB,
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error: string | null; missingSuppliersTable: boolean; changed: boolean }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { error: null, missingSuppliersTable: false, changed: false };
  }

  const deleted = await pushDirty(db, supabase, "deletes");
  if (deleted.error && !deleted.wrote) {
    return {
      error: deleted.error,
      missingSuppliersTable: deleted.missingSuppliersTable,
      changed: false,
    };
  }

  const purchaseReconcile = await applyIdReconcile(db, "purchases", userId, supabase);
  const supplierReconcile = deleted.missingSuppliersTable
    ? { changed: false, missingTable: true }
    : await applyIdReconcile(db, "suppliers", userId, supabase);

  const pushed = await pushDirty(db, supabase, "upserts");
  const seeded = (await db.meta.get("seeded"))?.value === "1";
  const lastFull = Number((await db.meta.get("lastFullPull"))?.value || 0);
  const lastRemoteAt = (await db.meta.get("lastRemoteAt"))?.value ?? null;
  const needFull = !seeded || !lastRemoteAt || Date.now() - lastFull > FULL_PULL_MS;
  const missingSuppliersTable =
    pushed.missingSuppliersTable ||
    deleted.missingSuppliersTable ||
    supplierReconcile.missingTable;
  const reconcileChanged = purchaseReconcile.changed || supplierReconcile.changed;

  if (needFull) {
    const remote = await pullAll(supabase, userId);
    const merged = await mergePull(db, remote);
    const watermark = maxUpdated([...remote.purchases, ...remote.suppliers]) ?? nowIso();
    await db.meta.put({ key: "lastFullPull", value: String(Date.now()) });
    await db.meta.put({ key: "lastRemoteAt", value: watermark });
    await db.meta.put({
      key: "seenPurchaseIds",
      value: JSON.stringify(remote.purchases.map((row) => row.id)),
    });
    if (!remote.missingSuppliersTable) {
      await db.meta.put({
        key: "seenSupplierIds",
        value: JSON.stringify(remote.suppliers.map((row) => row.id)),
      });
    }
    return {
      error: pushed.error ?? deleted.error,
      missingSuppliersTable: remote.missingSuppliersTable || missingSuppliersTable,
      changed: pushed.wrote || deleted.wrote || merged || reconcileChanged,
    };
  }

  const remote = await pullUpdated(supabase, userId, lastRemoteAt);
  const merged = await mergeIncremental(db, remote);
  const watermark = maxUpdated([...remote.purchases, ...remote.suppliers]);
  if (watermark && watermark >= lastRemoteAt) {
    await db.meta.put({ key: "lastRemoteAt", value: watermark });
  }
  return {
    error: pushed.error ?? deleted.error,
    missingSuppliersTable: remote.missingSuppliersTable || missingSuppliersTable,
    changed: pushed.wrote || deleted.wrote || merged || reconcileChanged,
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
    lines: (input.lines && input.lines.length > 0
      ? input.lines
      : decodeLines({
          notes: input.notes,
          taxable_value: input.taxable_value,
          gst_rate: input.gst_rate,
          invoice_total: input.invoice_total,
          cgst: input.cgst,
          sgst: input.sgst,
          igst: input.igst,
        })
    ).map((line) => ({
      taxable: line.taxable,
      rate: line.rate,
      gst: line.gst,
    })),
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
