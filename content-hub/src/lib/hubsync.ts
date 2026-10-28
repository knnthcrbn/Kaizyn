// The shared hub: one document on the server that every signed-in browser
// keeps in step with. Used by both sides, so it holds no browser or server code.
//
// Each record carries updatedAt and the newest copy wins, record by record, so
// two people working on different cards never collide. A deleted record leaves
// a dated tombstone, so a browser that still has an old copy can't bring it
// back. Resetting or restoring a backup starts a new generation, which every
// browser adopts wholesale on its next sync.
import type { Edit } from "./studio/types";
import type { ContentItem, PlanCollection, PlanRecords, Story, SwipeItem, VoiceEntry } from "./types";

/** The calendar's, analytics' and accounts' collections (28 Oct). */
export const PLAN_COLLECTIONS = [
  "accounts",
  "posts",
  "goals",
  "days",
  "reviews",
  "tests",
  "sounds",
  // Clipping (28 Oct).
  "clippers",
  "drops",
  "submissions",
  "payouts",
] as const satisfies readonly PlanCollection[];

export const COLLECTIONS = ["items", "stories", "voiceEntries", "swipe", "edits", ...PLAN_COLLECTIONS] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface HubRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export type HubData = {
  items: ContentItem[];
  stories: Story[];
  voiceEntries: VoiceEntry[];
  swipe: SwipeItem[];
  /** Studio edits (lib/studio/types.ts). */
  edits: Edit[];
  voiceProfile: { text: string; at: number };
  activityDays: string[];
} & { [C in PlanCollection]: PlanRecords[C][] };

export type HubDoc = HubData & {
  gen: number;
  /** Goes up by one on every save, so a browser can tell an older copy from a newer one. */
  rev: number;
  /** When each deleted record went, by collection and id. */
  deleted: Record<Collection, Record<string, number>>;
};

export interface HubOps {
  /** The generation these changes were made against. */
  gen: number;
  /** Replace the whole hub with `upserts` (reset, or restore from a backup). */
  reset?: boolean;
  upserts?: Partial<{ [C in Collection]: HubRecord[] }>;
  /** Ids deleted, with when. */
  deletes?: Partial<Record<Collection, Record<string, number>>>;
  voiceProfile?: { text: string; at: number };
  activityDays?: string[];
}

/**
 * What one browser and the server last agreed on. Kept in the same saved
 * snapshot as the browser's copy of the hub, so the two always match even
 * with several tabs open.
 */
export interface SyncBase {
  gen: number;
  rev: number;
  etag: string | null;
  /** id -> updatedAt for every record the server had. */
  ids: Record<Collection, Record<string, number>>;
  profileAt: number;
  days: string[];
}

export const HUB_PATH = "hub/state.json";

// Tombstones only need to outlive the longest a browser stays away with an
// old copy. Past this, a returning browser's copy is dropped anyway because
// it was already synced (see the client's merge).
const TOMBSTONE_DAYS = 90;
const MAX_DAYS = 400;

export const emptyDoc = (gen = 1): HubDoc =>
  ({
    gen,
    rev: 0,
    ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
    voiceProfile: { text: "", at: 0 },
    activityDays: [],
    deleted: Object.fromEntries(COLLECTIONS.map((c) => [c, {}])),
  }) as unknown as HubDoc;

/**
 * A stored hub with every part present. Collections added after a hub was
 * first saved (Studio's edits, 27 Oct; the calendar's, analytics' and
 * accounts', 28 Oct) are simply missing from older ones.
 */
export function normalizeDoc(doc: Partial<HubDoc> | null | undefined): HubDoc {
  const base = emptyDoc(doc?.gen ?? 1);
  const out = { ...base, ...(doc ?? {}) } as HubDoc;
  for (const c of COLLECTIONS) if (!Array.isArray(out[c])) (out[c] as HubRecord[]) = [];
  out.deleted = { ...base.deleted, ...(doc?.deleted ?? {}) };
  return out;
}

export const isEmpty = (d: HubData) =>
  COLLECTIONS.every((c) => d[c].length === 0) && !d.voiceProfile.text && d.activityDays.length === 0;

/** A starter record nobody has changed: safe to drop wherever the team already decided about it. */
export const untouchedSeed = (r: HubRecord) => r.id.startsWith("seed-") && r.updatedAt === r.createdAt;

const isRecord = (r: unknown): r is HubRecord =>
  !!r &&
  typeof r === "object" &&
  typeof (r as HubRecord).id === "string" &&
  (r as HubRecord).id.length > 0 &&
  (r as HubRecord).id.length <= 120 &&
  Number.isFinite((r as HubRecord).updatedAt) &&
  Number.isFinite((r as HubRecord).createdAt);

const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Keeps only well-formed parts of what a browser sent. */
export function cleanOps(raw: unknown): HubOps | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Number.isFinite(o.gen)) return null;
  const ops: HubOps = { gen: o.gen as number, reset: o.reset === true };
  const up = (o.upserts ?? {}) as Record<string, unknown>;
  const del = (o.deletes ?? {}) as Record<string, unknown>;
  for (const c of COLLECTIONS) {
    if (Array.isArray(up[c])) (ops.upserts ??= {})[c] = (up[c] as unknown[]).filter(isRecord);
    if (del[c] && typeof del[c] === "object") {
      const entries = Object.entries(del[c] as Record<string, unknown>).filter(([, at]) => Number.isFinite(at));
      (ops.deletes ??= {})[c] = Object.fromEntries(entries) as Record<string, number>;
    }
  }
  const vp = o.voiceProfile as { text?: unknown; at?: unknown } | undefined;
  if (vp && typeof vp.text === "string" && Number.isFinite(vp.at)) ops.voiceProfile = { text: vp.text, at: vp.at as number };
  if (Array.isArray(o.activityDays)) ops.activityDays = o.activityDays.filter(isDay);
  return ops;
}

/** Applies one browser's changes to the stored hub and returns the new one. */
export function applyOps(stored: HubDoc, ops: HubOps, now = Date.now()): HubDoc {
  const doc = normalizeDoc(stored);
  if (ops.reset) {
    const next = emptyDoc(doc.gen + 1);
    next.rev = (doc.rev ?? 0) + 1;
    for (const c of COLLECTIONS) (next[c] as HubRecord[]) = ops.upserts?.[c] ?? [];
    next.voiceProfile = ops.voiceProfile ?? { text: "", at: now };
    next.activityDays = [...new Set(ops.activityDays ?? [])].sort().slice(-MAX_DAYS);
    return next;
  }

  const next: HubDoc = { ...doc, rev: (doc.rev ?? 0) + 1, deleted: { ...emptyDoc().deleted } };
  const cutoff = now - TOMBSTONE_DAYS * 86_400_000;
  for (const c of COLLECTIONS) {
    const tombs: Record<string, number> = {};
    for (const [id, at] of Object.entries(doc.deleted?.[c] ?? {})) if (at > cutoff) tombs[id] = at;

    const byId = new Map((doc[c] as HubRecord[]).map((r) => [r.id, r]));
    const added: string[] = [];
    for (const r of ops.upserts?.[c] ?? []) {
      if ((tombs[r.id] ?? -Infinity) >= r.updatedAt) continue; // deleted after this copy was made
      const cur = byId.get(r.id);
      if (cur && cur.updatedAt > r.updatedAt) continue; // someone saved a newer copy
      if (!cur) added.push(r.id);
      byId.set(r.id, r);
      delete tombs[r.id];
    }
    for (const [id, at] of Object.entries(ops.deletes?.[c] ?? {})) {
      const cur = byId.get(id);
      if (cur && cur.updatedAt > at) continue; // edited after it was deleted elsewhere
      byId.delete(id);
      tombs[id] = Math.max(tombs[id] ?? 0, at);
    }
    // New records go first, the way each browser lists them.
    const kept = (doc[c] as HubRecord[]).filter((r) => byId.has(r.id)).map((r) => byId.get(r.id)!);
    const fresh = added.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    (next[c] as HubRecord[]) = [...fresh, ...kept];
    next.deleted[c] = tombs;
  }
  if (ops.voiceProfile && ops.voiceProfile.at > doc.voiceProfile.at) next.voiceProfile = ops.voiceProfile;
  if (ops.activityDays?.length) {
    next.activityDays = [...new Set([...doc.activityDays, ...ops.activityDays])].sort().slice(-MAX_DAYS);
  }
  return next;
}
