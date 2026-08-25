import Dexie, { type Table } from "dexie";
import type { Profile, Purchase, Supplier } from "@/lib/types";

export type LocalPurchase = Purchase & { dirty: number; deleted: number };
export type LocalSupplier = Supplier & { dirty: number; deleted: number };
export type LocalProfile = Profile & { dirty: number };
export type MetaRow = { key: string; value: string };

export class GstDB extends Dexie {
  purchases!: Table<LocalPurchase, string>;
  suppliers!: Table<LocalSupplier, string>;
  profile!: Table<LocalProfile, string>;
  meta!: Table<MetaRow, string>;

  constructor(userId: string) {
    super(`gst-registry-${userId}`);
    this.version(1).stores({
      purchases: "id, invoice_date, supplier_id, dirty, deleted",
      suppliers: "id, name, dirty, deleted",
      profile: "id",
      meta: "key",
    });
  }
}

const dbs = new Map<string, GstDB>();

export function getDb(userId: string): GstDB {
  let db = dbs.get(userId);
  if (!db) {
    db = new GstDB(userId);
    dbs.set(userId, db);
  }
  return db;
}

export async function deleteDb(userId: string): Promise<void> {
  const db = dbs.get(userId);
  if (db) {
    db.close();
    dbs.delete(userId);
  }
  await Dexie.delete(`gst-registry-${userId}`);
}

export function stripPurchase(row: LocalPurchase): Purchase {
  const { dirty, deleted, ...rest } = row;
  void dirty;
  void deleted;
  return rest;
}

export function stripSupplier(row: LocalSupplier): Supplier {
  const { dirty, deleted, ...rest } = row;
  void dirty;
  void deleted;
  return rest;
}

export function stripProfile(row: LocalProfile): Profile {
  const { dirty, ...rest } = row;
  void dirty;
  return rest;
}
