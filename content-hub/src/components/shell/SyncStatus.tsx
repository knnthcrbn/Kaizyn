"use client";

import { useEffect, useState } from "react";
import { CloudAlert, CloudCheck, CloudOff, CloudUpload } from "lucide-react";
import { syncNow, useSync } from "@/lib/sync";

export function ago(t: number | null, now = Date.now()) {
  if (!t) return "not yet";
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Re-renders every half minute so "x min ago" stays true. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function syncLabel(status: string, lastSync: number | null, error: string | null, now: number) {
  if (status === "syncing") return "Syncing with the team…";
  if (status === "synced") return `Shared with the team. Synced ${ago(lastSync, now)}.`;
  return error ?? "";
}

/** The cloud in the top bar: shows whether this screen is in step with the team, and syncs on click. */
export function SyncStatus() {
  const { status, lastSync, error } = useSync();
  const now = useNow();
  if (status === "off") return null;
  const Icon = { syncing: CloudUpload, synced: CloudCheck, offline: CloudOff, error: CloudAlert }[status];
  const tone = {
    syncing: "text-faint",
    synced: "text-ghost hover:text-faint",
    offline: "text-warning",
    error: "text-critical-text",
  }[status];
  const label = syncLabel(status, lastSync, error, now);
  return (
    <button
      onClick={() => void syncNow()}
      title={label}
      aria-label={label}
      data-sync={status}
      className={`rounded-md p-1.5 transition-colors ${tone} ${status === "syncing" ? "animate-pulse" : ""}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
