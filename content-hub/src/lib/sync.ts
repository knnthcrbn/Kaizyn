"use client";

// Team sync: keeps this browser's copy of the hub in step with the shared one
// on the server (app/api/hub). Edits are saved here first, as before, then go
// up a few seconds later; other people's edits come down every minute while
// someone is using the tab, and whenever it comes back into view. Chats stay
// on each device.
//
// Every save and every check is a Blob operation the plan counts, so saves
// are batched and a tab nobody is touching stops checking.
import { create } from "zustand";
import { useHub, type HubContent } from "./store";
import {
  COLLECTIONS,
  isEmpty,
  untouchedSeed,
  type Collection,
  type HubDoc,
  type HubOps,
  type HubRecord,
  type SyncBase,
} from "./hubsync";
import { IN_CLAUDE } from "./platform";

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error";

export const useSync = create<{ status: SyncStatus; lastSync: number | null; error: string | null }>(() => ({
  status: "off",
  lastSync: null,
  error: null,
}));

const POLL_MS = 60_000;
/** Polling stops once nobody has touched the tab for this long. */
const IDLE_MS = 5 * 60_000;
const DATA_KEYS = ["items", "stories", "voiceEntries", "swipe", "voiceProfile", "voiceProfileAt", "activityDays"] as const;

const recordsOf = (s: HubContent) =>
  ({ items: s.items, stories: s.stories, voiceEntries: s.voiceEntries, swipe: s.swipe }) as Record<Collection, HubRecord[]>;

const contentOf = (doc: HubDoc): HubContent => ({
  items: doc.items,
  stories: doc.stories,
  voiceEntries: doc.voiceEntries,
  swipe: doc.swipe,
  voiceProfile: doc.voiceProfile.text,
  voiceProfileAt: doc.voiceProfile.at,
  activityDays: doc.activityDays,
});

function baseOf(doc: HubDoc, etag: string | null): SyncBase {
  const ids = {} as SyncBase["ids"];
  for (const c of COLLECTIONS) ids[c] = Object.fromEntries((doc[c] as HubRecord[]).map((r) => [r.id, r.updatedAt]));
  return { gen: doc.gen, rev: doc.rev ?? 0, etag, ids, profileAt: doc.voiceProfile.at, days: [...doc.activityDays] };
}

/** This browser's changes since it last agreed with the server, or null if none. */
function pending(s: HubContent, base: SyncBase): HubOps | null {
  const ops: HubOps = { gen: base.gen };
  let any = false;
  const now = Date.now();
  const records = recordsOf(s);
  for (const c of COLLECTIONS) {
    const known = base.ids[c] ?? {};
    const changed = records[c].filter((r) => known[r.id] !== r.updatedAt);
    if (changed.length) (ops.upserts ??= {})[c] = changed;
    const here = new Set(records[c].map((r) => r.id));
    const gone = Object.keys(known).filter((id) => !here.has(id));
    if (gone.length) (ops.deletes ??= {})[c] = Object.fromEntries(gone.map((id) => [id, now]));
    any ||= changed.length > 0 || gone.length > 0;
  }
  if (s.voiceProfileAt > base.profileAt) {
    ops.voiceProfile = { text: s.voiceProfile, at: s.voiceProfileAt };
    any = true;
  }
  const synced = new Set(base.days);
  const days = s.activityDays.filter((d) => !synced.has(d));
  if (days.length) {
    ops.activityDays = days;
    any = true;
  }
  return any ? ops : null;
}

/**
 * The server's hub combined with whatever here hasn't gone up yet. `base` is
 * what was agreed before, which tells a record deleted here (in base, missing
 * here) from one added elsewhere (in neither), and so on.
 */
function merge(doc: HubDoc, base: SyncBase | null, s: HubContent): HubContent {
  // A reset or a restored backup: take the new hub as it is.
  if (base && doc.gen !== base.gen) return contentOf(doc);
  // First sync in this browser. Starter cards nobody touched follow the team:
  // ones the team deleted go here too, and ones deleted here go there.
  const joining = !base;
  const local = recordsOf(s);
  const out = {} as Record<Collection, HubRecord[]>;
  for (const c of COLLECTIONS) {
    const known = base?.ids[c] ?? {};
    const tombs = doc.deleted?.[c] ?? {};
    const remote = new Map((doc[c] as HubRecord[]).map((r) => [r.id, r]));
    const here = new Set(local[c].map((r) => r.id));
    const added = (doc[c] as HubRecord[]).filter(
      (r) => !here.has(r.id) && !(r.id in known) && !(joining && untouchedSeed(r)),
    );
    const kept = local[c].flatMap((l) => {
      const r = remote.get(l.id);
      if (r) return [r.updatedAt > l.updatedAt ? r : l];
      if ((tombs[l.id] ?? -Infinity) >= l.updatedAt) return []; // deleted elsewhere after this copy
      if (known[l.id] === l.updatedAt) return []; // was on the server, unchanged here, gone since
      if (joining && untouchedSeed(l)) return [];
      return [l]; // made here, not sent yet
    });
    out[c] = [...added, ...kept];
  }
  const synced = new Set(base?.days ?? []);
  const days = [...new Set([...doc.activityDays, ...s.activityDays.filter((d) => !synced.has(d))])].sort();
  const remoteProfile = doc.voiceProfile.at > s.voiceProfileAt;
  return {
    items: out.items as HubContent["items"],
    stories: out.stories as HubContent["stories"],
    voiceEntries: out.voiceEntries as HubContent["voiceEntries"],
    swipe: out.swipe as HubContent["swipe"],
    voiceProfile: remoteProfile ? doc.voiceProfile.text : s.voiceProfile,
    voiceProfileAt: remoteProfile ? doc.voiceProfile.at : s.voiceProfileAt,
    activityDays: days,
  };
}

const sameList = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

let applying = false;

/** Writes merged content and the new base in one go, touching only what changed. */
function apply(next: HubContent, base: SyncBase) {
  const s = useHub.getState();
  const patch: Partial<HubContent> & { syncBase: SyncBase } = { syncBase: base };
  for (const c of COLLECTIONS) if (!sameList(s[c], next[c])) (patch as Record<string, unknown>)[c] = next[c];
  if (s.voiceProfile !== next.voiceProfile || s.voiceProfileAt !== next.voiceProfileAt) {
    patch.voiceProfile = next.voiceProfile;
    patch.voiceProfileAt = next.voiceProfileAt;
  }
  if (!sameList(s.activityDays, next.activityDays)) patch.activityDays = next.activityDays;
  applying = true;
  try {
    useHub.setState(patch);
  } finally {
    applying = false;
  }
}

class SyncError extends Error {
  constructor(
    message: string,
    readonly offline = false,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new SyncError("Offline. Changes are kept on this device and go up when you're back.", true);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) throw new SyncError("Signed out. Sign in again to keep syncing.");
  if (!res.ok) throw new SyncError(data.error ?? `The hub didn't answer (${res.status}).`);
  return data;
}

function post<T>(ops: HubOps) {
  const body = JSON.stringify(ops);
  // keepalive lets a save started as the tab closes still arrive (small bodies only).
  return call<T>("/api/hub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: body.length < 60_000,
  });
}

let lastPull = 0;
let retry: ReturnType<typeof setTimeout> | undefined;

async function cycle(pull: boolean) {
  let base = useHub.getState().syncBase;
  const first = !base;
  if (first || pending(useHub.getState(), base!)) useSync.setState({ status: "syncing" });
  try {
    if (pull || !base) {
      lastPull = Date.now();
      const since = base?.etag ? `?since=${encodeURIComponent(base.etag)}` : "";
      const res = await call<{ doc?: HubDoc; etag: string | null; unchanged?: true }>(`/api/hub${since}`);
      // A server can answer from a copy a few seconds old; never step back to it.
      const older = !!res.doc && !!base && (res.doc.rev ?? 0) <= base.rev;
      if (older && base && (res.doc!.rev ?? 0) === base.rev && res.etag !== base.etag) {
        // The same save under the tag this server knows it by: ask with that next time.
        base = { ...base, etag: res.etag };
        useHub.setState({ syncBase: base });
      }
      if (!res.unchanged && res.doc && !older) {
        if (!base && isEmpty(res.doc)) {
          // The first browser on the team: everything here goes up as it is.
          base = baseOf(res.doc, res.etag);
          useHub.setState({ syncBase: base });
        } else {
          const next = baseOf(res.doc, res.etag);
          apply(merge(res.doc, base, useHub.getState()), next);
          base = next;
        }
      }
    }
    const ops = pending(useHub.getState(), base!);
    if (ops) {
      useSync.setState({ status: "syncing" });
      const res = await post<{ doc: HubDoc; etag: string }>(ops);
      const next = baseOf(res.doc, res.etag);
      apply(merge(res.doc, base, useHub.getState()), next);
      base = next;
    }
    useSync.setState({ status: "synced", lastSync: Date.now(), error: null });
    // Edits made while this was on the wire.
    if (pending(useHub.getState(), base!)) schedulePush();
  } catch (e) {
    const err = e instanceof SyncError ? e : new SyncError((e as Error).message);
    useSync.setState({ status: err.offline ? "offline" : "error", error: err.message });
    // Try again soon rather than waiting for the next minute's check.
    clearTimeout(retry);
    if (started) retry = setTimeout(() => void sync(true), 10_000);
  }
}

// One sync at a time, in order; requests made meanwhile fold into the next one.
let lock: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn);
  lock = run.catch(() => {});
  return run;
}
let queued: Promise<void> | null = null;
let queuedPull = false;
function sync(pull: boolean) {
  queuedPull ||= pull;
  queued ??= exclusive(async () => {
    queued = null;
    const p = queuedPull;
    queuedPull = false;
    await cycle(p);
  });
  return queued;
}

// Saves go up 3 s after the last edit, and at least every 15 s while typing.
let timer: ReturnType<typeof setTimeout> | undefined;
let firstEdit: number | null = null;
let started = false;

function schedulePush() {
  if (!started) return;
  clearTimeout(timer);
  firstEdit ??= Date.now();
  timer = setTimeout(flush, Math.max(0, Math.min(3000, firstEdit + 15_000 - Date.now())));
}

function flush() {
  clearTimeout(timer);
  timer = undefined;
  firstEdit = null;
  void sync(false);
}

/** Starts syncing; returns the function that stops it. */
export function startSync() {
  if (IN_CLAUDE || started || typeof window === "undefined") return () => {};
  started = true;
  const unsub = useHub.subscribe((s, prev) => {
    if (!applying && DATA_KEYS.some((k) => s[k] !== prev[k])) schedulePush();
  });
  const pullIfStale = () => {
    if (document.visibilityState === "visible" && Date.now() - lastPull > 15_000) void sync(true);
  };
  let lastActive = Date.now();
  const active = () => {
    // Coming back after a while: check straight away rather than at the next tick.
    if (Date.now() - lastActive > POLL_MS) pullIfStale();
    lastActive = Date.now();
  };
  const onOnline = () => void sync(true);
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (timer) flush(); // send anything waiting before the tab goes to sleep
    } else pullIfStale();
  };
  const poll = setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastActive < IDLE_MS) void sync(true);
  }, POLL_MS);
  const activity = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  for (const e of activity) window.addEventListener(e, active, { passive: true, capture: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", pullIfStale);
  window.addEventListener("online", onOnline);
  useSync.setState({ status: "syncing" });
  void sync(true);
  return () => {
    started = false;
    unsub();
    clearInterval(poll);
    clearTimeout(timer);
    for (const e of activity) window.removeEventListener(e, active, { capture: true });
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", pullIfStale);
    window.removeEventListener("online", onOnline);
    clearTimeout(retry);
    useSync.setState({ status: "off" });
  };
}

/** Checks for changes now (the sync button). */
export const syncNow = () => (started ? sync(true) : Promise.resolve());

/**
 * Replaces the whole hub, for everyone when syncing is on: Reset and Restore
 * from backup. Other browsers take it on their next sync, dropping anything
 * they hadn't sent yet.
 */
export function replaceHub(content: HubContent) {
  if (!started) {
    useHub.setState(content);
    return Promise.resolve();
  }
  clearTimeout(timer);
  timer = undefined;
  firstEdit = null;
  return exclusive(async () => {
    const base = useHub.getState().syncBase;
    const res = await post<{ doc: HubDoc; etag: string }>({
      gen: base?.gen ?? 0,
      reset: true,
      upserts: recordsOf(content),
      voiceProfile: { text: content.voiceProfile, at: Date.now() },
      activityDays: content.activityDays,
    });
    apply(contentOf(res.doc), baseOf(res.doc, res.etag));
    useSync.setState({ status: "synced", lastSync: Date.now(), error: null });
  });
}
