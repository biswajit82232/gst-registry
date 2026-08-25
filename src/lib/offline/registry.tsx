"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { currentMonth, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { InputStatus, Profile, Purchase, PurchaseInput, Supplier } from "@/lib/types";
import {
  deleteDb,
  getDb,
  type GstDB,
  type LocalProfile,
  type LocalPurchase,
  type LocalSupplier,
  stripProfile,
  stripPurchase,
  stripSupplier,
} from "./db";
import {
  findLocalSupplier,
  newId,
  nowIso,
  purchaseFromInput,
  runSync,
  SYNC_MS,
} from "./sync";

function sortPurchases(rows: Purchase[]): Purchase[] {
  return rows.sort(
    (a, b) => b.invoice_date.localeCompare(a.invoice_date) || b.id.localeCompare(a.id),
  );
}

function samePurchases(a: Purchase[], b: Purchase[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].updated_at !== b[i].updated_at ||
      a[i].input_status !== b[i].input_status
    ) {
      return false;
    }
  }
  return true;
}

function sameSuppliers(a: Supplier[], b: Supplier[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].updated_at !== b[i].updated_at || a[i].name !== b[i].name) {
      return false;
    }
  }
  return true;
}

export type Registry = {
  ready: boolean;
  firstDownload: boolean;
  syncing: boolean;
  online: boolean;
  lastSyncAt: number | null;
  pending: number;
  syncError: string | null;
  profile: Profile | null;
  purchases: Purchase[];
  suppliers: Supplier[];
  missingSuppliersTable: boolean;
  userId: string | null;
  userEmail: string | null;
  month: string;
  setMonth: (month: string) => void;
  savePurchase: (input: PurchaseInput, id?: string) => Promise<Purchase>;
  deletePurchase: (id: string) => Promise<void>;
  saveSupplier: (input: {
    name: string;
    gstin?: string | null;
    phone?: string | null;
    notes?: string | null;
    id?: string;
  }) => Promise<Supplier>;
  deleteSupplier: (id: string) => Promise<void>;
  saveProfile: (partial: {
    business_name: string | null;
    gstin: string | null;
  }) => Promise<void>;
  markInput: (id: string, status: InputStatus) => Promise<void>;
  markManyInput: (ids: string[], status: InputStatus) => Promise<void>;
  importPurchases: (rows: PurchaseInput[]) => Promise<number>;
  syncNow: () => Promise<void>;
  clearLocal: () => Promise<void>;
};

type RegistryData = Omit<
  Registry,
  "ready" | "firstDownload" | "syncing" | "online" | "lastSyncAt" | "pending" | "syncNow"
>;

type SyncStatus = Pick<
  Registry,
  "firstDownload" | "syncing" | "online" | "lastSyncAt" | "pending" | "syncError" | "syncNow"
>;

const DataContext = createContext<RegistryData | null>(null);
const SyncContext = createContext<SyncStatus | null>(null);

export function useRegistry(): RegistryData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useRegistry must be used inside RegistryProvider");
  return ctx;
}

export function useSyncStatus(): SyncStatus {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncStatus must be used inside RegistryProvider");
  return ctx;
}

export function RegistryProvider({ children }: { children: React.ReactNode }) {
  const dbRef = useRef<GstDB | null>(null);
  const userIdRef = useRef<string | null>(null);
  const emailRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const queuedRef = useRef(false);
  const pendingRef = useRef(0);
  const firstDownloadRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [firstDownload, setFirstDownload] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [missingSuppliersTable, setMissingSuppliersTable] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [month, setMonthState] = useState(currentMonth);

  const setMonth = useCallback((next: string) => {
    setMonthState(next);
  }, []);

  const reload = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    const [localPurchases, localSuppliers, localProfiles, meta] = await Promise.all([
      db.purchases.toArray(),
      db.suppliers.toArray(),
      db.profile.toArray(),
      db.meta.toArray(),
    ]);
    const nextPurchases = sortPurchases(
      localPurchases.filter((row) => !row.deleted).map(stripPurchase),
    );
    const nextSuppliers = localSuppliers
      .filter((row) => !row.deleted)
      .map(stripSupplier)
      .sort((a, b) => a.name.localeCompare(b.name));
    const p = localProfiles[0];
    const nextProfile = p ? stripProfile(p) : null;
    const nextPending =
      localPurchases.filter((row) => row.dirty).length +
      localSuppliers.filter((row) => row.dirty).length +
      localProfiles.filter((row) => row.dirty).length;
    pendingRef.current = nextPending;
    setPurchases((prev) => (samePurchases(prev, nextPurchases) ? prev : nextPurchases));
    setSuppliers((prev) => (sameSuppliers(prev, nextSuppliers) ? prev : nextSuppliers));
    setProfile((prev) =>
      prev?.id === nextProfile?.id &&
      prev?.business_name === nextProfile?.business_name &&
      prev?.gstin === nextProfile?.gstin &&
      prev?.email === nextProfile?.email
        ? prev
        : nextProfile,
    );
    setPending(nextPending);
    const last = meta.find((row) => row.key === "lastSync")?.value;
    setLastSyncAt(last ? Number(last) : null);
    setMissingSuppliersTable(meta.find((row) => row.key === "missingSuppliers")?.value === "1");
    const seeded = meta.find((row) => row.key === "seeded")?.value === "1";
    firstDownloadRef.current = !seeded;
    setFirstDownload(!seeded);
  }, []);

  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  const syncNow = useCallback(async function syncNow() {
    const db = dbRef.current;
    const uid = userIdRef.current;
    if (!db || !uid) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOnline(false);
      return;
    }
    if (syncingRef.current) {
      queuedRef.current = true;
      return;
    }
    const show = firstDownloadRef.current || pendingRef.current > 0;
    syncingRef.current = true;
    if (show) setSyncing(true);
    try {
      const supabase = createClient();
      const result = await runSync(db, supabase, uid);
      setSyncError(result.error);
      setMissingSuppliersTable(result.missingSuppliersTable);
      if (result.changed) await reloadRef.current();
      else setLastSyncAt(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed.";
      setSyncError(message);
    } finally {
      syncingRef.current = false;
      if (show) setSyncing(false);
      if (queuedRef.current) {
        queuedRef.current = false;
        void syncNow();
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setReady(true);
        return;
      }
      userIdRef.current = user.id;
      emailRef.current = user.email ?? null;
      setUserId(user.id);
      setUserEmail(user.email ?? null);
      const db = getDb(user.id);
      dbRef.current = db;
      await reload();
      if (!alive) return;
      const seeded = (await db.meta.get("seeded"))?.value === "1";
      if (!alive) return;
      setFirstDownload(!seeded);
      setReady(true);
      await syncNow();
    })().catch(() => {
      if (alive) {
        setSyncError("Could not open the local register.");
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [reload, syncNow]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncNow();
    }, SYNC_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [syncNow]);

  const requireDb = useCallback(() => {
    const db = dbRef.current;
    const uid = userIdRef.current;
    if (!db || !uid) throw new Error("Please sign in again.");
    return { db, uid };
  }, []);

  const savePurchase = useCallback(
    async (input: PurchaseInput, id?: string) => {
      const { db, uid } = requireDb();
      const existing = id ? await db.purchases.get(id) : undefined;
      const purchase = purchaseFromInput(uid, { ...input, id }, existing ? stripPurchase(existing) : undefined);
      const row: LocalPurchase = { ...purchase, dirty: 1, deleted: 0 };
      await db.purchases.put(row);
      setPurchases((prev) => sortPurchases([...prev.filter((item) => item.id !== purchase.id), purchase]));
      if (!existing?.dirty) {
        pendingRef.current += 1;
        setPending(pendingRef.current);
      }
      void syncNow();
      return purchase;
    },
    [requireDb, syncNow],
  );

  const deletePurchase = useCallback(
    async (id: string) => {
      const { db } = requireDb();
      const existing = await db.purchases.get(id);
      if (!existing) return;
      await db.purchases.put({ ...existing, deleted: 1, dirty: 1, updated_at: nowIso() });
      setPurchases((prev) => prev.filter((row) => row.id !== id));
      if (!existing.dirty) {
        pendingRef.current += 1;
        setPending(pendingRef.current);
      }
      void syncNow();
    },
    [requireDb, syncNow],
  );

  const saveSupplier = useCallback(
    async (input: {
      name: string;
      gstin?: string | null;
      phone?: string | null;
      notes?: string | null;
      id?: string;
    }) => {
      const { db, uid } = requireDb();
      const name = input.name.trim();
      const gstin = input.gstin?.trim().toUpperCase() || null;
      const live = (await db.suppliers.toArray()).filter((row) => !row.deleted).map(stripSupplier);
      const match = findLocalSupplier(live, { name, gstin, id: input.id });
      const now = nowIso();
      const next: LocalSupplier = match
        ? {
            ...match,
            name,
            gstin: gstin || match.gstin,
            phone: input.phone !== undefined ? input.phone || null : match.phone,
            notes: input.notes !== undefined ? input.notes || null : match.notes,
            updated_at: now,
            dirty: 1,
            deleted: 0,
          }
        : {
            id: input.id || newId(),
            user_id: uid,
            name,
            gstin,
            phone: input.phone || null,
            notes: input.notes || null,
            created_at: now,
            updated_at: now,
            dirty: 1,
            deleted: 0,
          };
      await db.suppliers.put(next);
      if (input.id && match && input.id !== match.id) {
        const old = await db.suppliers.get(input.id);
        if (old) await db.suppliers.put({ ...old, deleted: 1, dirty: 1, updated_at: now });
      }
      const targetIds = new Set([next.id, input.id].filter(Boolean) as string[]);
      const bills = await db.purchases.toArray();
      for (const bill of bills) {
        if (bill.deleted) continue;
        const linked =
          (bill.supplier_id && targetIds.has(bill.supplier_id)) ||
          (next.gstin && bill.supplier_gstin === next.gstin);
        if (!linked) continue;
        await db.purchases.put({
          ...bill,
          supplier_id: next.id,
          supplier_name: next.name,
          supplier_gstin: next.gstin,
          dirty: 1,
          updated_at: now,
        });
      }
      await reload();
      void syncNow();
      return stripSupplier(next);
    },
    [reload, requireDb, syncNow],
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      const { db } = requireDb();
      const existing = await db.suppliers.get(id);
      if (!existing) return;
      await db.suppliers.put({ ...existing, deleted: 1, dirty: 1, updated_at: nowIso() });
      await reload();
      void syncNow();
    },
    [reload, requireDb, syncNow],
  );

  const saveProfile = useCallback(
    async (partial: { business_name: string | null; gstin: string | null }) => {
      const { db, uid } = requireDb();
      const current = (await db.profile.get(uid)) ?? null;
      const gstin = partial.gstin?.trim().toUpperCase() || null;
      const row: LocalProfile = {
        id: uid,
        email: current?.email ?? emailRef.current,
        business_name: partial.business_name?.trim() || null,
        gstin,
        state_code: gstin ? gstin.slice(0, 2) : null,
        dirty: 1,
      };
      await db.profile.put(row);
      setProfile(stripProfile(row));
      if (!current?.dirty) {
        pendingRef.current += 1;
        setPending(pendingRef.current);
      }
      void syncNow();
    },
    [requireDb, syncNow],
  );

  const markInput = useCallback(
    async (id: string, status: InputStatus) => {
      const { db } = requireDb();
      const existing = await db.purchases.get(id);
      if (!existing || existing.deleted) return;
      const next: LocalPurchase = {
        ...existing,
        input_status: status,
        input_on: status === "waiting" ? null : todayIso(),
        dirty: 1,
        updated_at: nowIso(),
      };
      await db.purchases.put(next);
      const stripped = stripPurchase(next);
      setPurchases((prev) => prev.map((row) => (row.id === id ? stripped : row)));
      if (!existing.dirty) {
        pendingRef.current += 1;
        setPending(pendingRef.current);
      }
      void syncNow();
    },
    [requireDb, syncNow],
  );

  const markManyInput = useCallback(
    async (ids: string[], status: InputStatus) => {
      const { db } = requireDb();
      const now = nowIso();
      const on = status === "waiting" ? null : todayIso();
      const changed = new Set<string>();
      await Promise.all(
        ids.map(async (id) => {
          const existing = await db.purchases.get(id);
          if (!existing || existing.deleted) return;
          await db.purchases.put({
            ...existing,
            input_status: status,
            input_on: on,
            dirty: 1,
            updated_at: now,
          });
          changed.add(id);
          if (!existing.dirty) pendingRef.current += 1;
        }),
      );
      if (changed.size === 0) return;
      setPurchases((prev) =>
        prev.map((row) =>
          changed.has(row.id) ? { ...row, input_status: status, input_on: on, updated_at: now } : row,
        ),
      );
      setPending(pendingRef.current);
      void syncNow();
    },
    [requireDb, syncNow],
  );

  const importPurchases = useCallback(
    async (rows: PurchaseInput[]) => {
      const { db, uid } = requireDb();
      const now = nowIso();
      for (const input of rows) {
        const live = (await db.suppliers.toArray()).filter((row) => !row.deleted).map(stripSupplier);
        const match = findLocalSupplier(live, {
          name: input.supplier_name,
          gstin: input.supplier_gstin,
        });
        let supplierId = match?.id ?? input.supplier_id ?? null;
        if (!match && input.supplier_name.trim()) {
          const created: LocalSupplier = {
            id: newId(),
            user_id: uid,
            name: input.supplier_name.trim(),
            gstin: input.supplier_gstin?.trim().toUpperCase() || null,
            phone: null,
            notes: null,
            created_at: now,
            updated_at: now,
            dirty: 1,
            deleted: 0,
          };
          await db.suppliers.put(created);
          supplierId = created.id;
        }
        const purchase = purchaseFromInput(uid, { ...input, supplier_id: supplierId });
        await db.purchases.put({ ...purchase, dirty: 1, deleted: 0 });
      }
      await reload();
      void syncNow();
      return rows.length;
    },
    [reload, requireDb, syncNow],
  );

  const clearLocal = useCallback(async () => {
    const uid = userIdRef.current;
    if (uid) await deleteDb(uid);
    dbRef.current = null;
    userIdRef.current = null;
    setPurchases([]);
    setSuppliers([]);
    setProfile(null);
  }, []);

  const data = useMemo<RegistryData>(
    () => ({
      syncError,
      profile,
      purchases,
      suppliers,
      missingSuppliersTable,
      userId,
      userEmail,
      month,
      setMonth,
      savePurchase,
      deletePurchase,
      saveSupplier,
      deleteSupplier,
      saveProfile,
      markInput,
      markManyInput,
      importPurchases,
      clearLocal,
    }),
    [
      syncError,
      profile,
      purchases,
      suppliers,
      missingSuppliersTable,
      userId,
      userEmail,
      month,
      setMonth,
      savePurchase,
      deletePurchase,
      saveSupplier,
      deleteSupplier,
      saveProfile,
      markInput,
      markManyInput,
      importPurchases,
      clearLocal,
    ],
  );

  const sync = useMemo<SyncStatus>(
    () => ({
      firstDownload,
      syncing,
      online,
      lastSyncAt,
      pending,
      syncError,
      syncNow,
    }),
    [firstDownload, syncing, online, lastSyncAt, pending, syncError, syncNow],
  );

  return (
    <DataContext.Provider value={data}>
      <SyncContext.Provider value={sync}>
        {!ready || firstDownload ? (
          <BootScreen firstDownload={firstDownload} error={syncError} onRetry={() => void syncNow()} />
        ) : (
          children
        )}
      </SyncContext.Provider>
    </DataContext.Provider>
  );
}

function BootScreen({
  firstDownload,
  error,
  onRetry,
}: {
  firstDownload: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="max-w-xs text-center">
        <p className="text-[15px] font-semibold" aria-live="polite">
          {firstDownload ? "Downloading register" : "Opening"}
        </p>
        <p className="mt-1 text-[12px] text-muted">
          {firstDownload
            ? "Once on this device. After that, bills open instantly."
            : "Reading the copy on this device."}
        </p>
        {error ? (
          <div className="mt-3 space-y-2">
            <p className="text-[12px] text-rose-700 dark:text-rose-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-3 text-[13px] font-semibold text-white dark:bg-teal-400 dark:text-teal-950"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
