"use client";

import { useSyncStatus } from "@/lib/offline/registry";

export function SyncBadge() {
  const { firstDownload, syncing, online, pending, lastSyncAt, syncError, syncNow } =
    useSyncStatus();

  const live =
    syncError ||
    (!online ? "Offline" : syncing ? "Syncing" : pending > 0 ? `${pending} waiting to sync` : "Synced");

  const tone = syncError
    ? "bg-rose-500"
    : !online
      ? "bg-amber-500"
      : firstDownload || syncing
        ? "bg-teal-600/70 dark:bg-teal-400/70"
        : pending > 0
          ? "bg-amber-500"
          : "bg-teal-700 dark:bg-teal-400";

  const pulse = firstDownload || syncing ? " animate-pulse" : "";

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      aria-label={live}
      title={syncError || (lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : live)}
      className="inline-flex h-11 min-w-11 items-center justify-center rounded-md active:bg-line/40"
    >
      <span className="sr-only">{live}. Tap to sync.</span>
      <span aria-hidden="true" className={`block h-2 w-2 rounded-full${pulse} ${tone}`} />
    </button>
  );
}
