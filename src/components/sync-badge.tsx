"use client";

import { useSyncStatus } from "@/lib/offline/registry";

export function SyncBadge() {
  const { firstDownload, syncing, online, pending, lastSyncAt, syncError, syncNow } =
    useSyncStatus();

  const live =
    syncError ||
    (!online ? "Offline" : syncing ? "Syncing" : pending > 0 ? `${pending} waiting to sync` : "Synced");

  let mark = "·";
  if (syncError) mark = "!";
  else if (!online) mark = "○";
  else if (firstDownload || syncing) mark = "…";
  else if (pending > 0) mark = String(pending);

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      aria-label={live}
      title={syncError || (lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : live)}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-md text-[12px] tabular-nums ${
        syncError ? "text-rose-700 dark:text-rose-300" : !online ? "text-amber-800 dark:text-amber-200" : "text-muted"
      }`}
    >
      <span className="sr-only">{live}. Tap to sync.</span>
      <span aria-hidden="true">{mark}</span>
    </button>
  );
}
