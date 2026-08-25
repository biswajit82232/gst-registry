"use client";

import { useSyncStatus } from "@/lib/offline/registry";

export function SyncBadge() {
  const { firstDownload, syncing, online, pending, lastSyncAt, syncError, syncNow } =
    useSyncStatus();

  let label = "OK";
  if (!online) label = pending > 0 ? `Off ${pending}` : "Off";
  else if (firstDownload) label = "…";
  else if (syncing) label = pending > 0 ? `↑${pending}` : "…";
  else if (pending > 0) label = `${pending}`;
  else if (lastSyncAt) label = "OK";

  const live =
    syncError ||
    (!online ? "Offline" : syncing ? "Syncing" : pending > 0 ? `${pending} waiting to sync` : "Synced");

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      aria-label={live}
      title={syncError || (lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : live)}
      className={`h-10 min-w-10 rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
        syncError
          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          : !online
            ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            : pending > 0
              ? "bg-brand-soft text-teal-800 dark:text-teal-200"
              : "text-muted"
      }`}
    >
      <span className="sr-only">{live}. Tap to sync.</span>
      <span aria-hidden="true">{syncError ? "!" : label}</span>
    </button>
  );
}
