// The shared hub on the server: one cached read, and changes written only if
// nobody wrote in between. Used by /api/hub (browsers syncing) and by the
// clipper portal's routes, which add a clipper's posts and accounts to the
// hub without ever sending the hub itself to a clipper.
import { readTagged, writeTagged, WriteConflict } from "./footage/store";
import { applyOps, emptyDoc, HUB_PATH, normalizeDoc, type HubDoc, type HubOps } from "./hubsync";

// Every open tab checks in about once a minute, and each Blob read counts
// against the plan's monthly allowance. One server instance answers those
// checks from memory for a few seconds instead of asking Blob each time; a
// copy this old is never a problem because browsers ignore anything older
// than what they already have (HubDoc.rev).
const FRESH_MS = 20_000;
let cache: { data: HubDoc | null; etag: string | null; at: number } | null = null;

export async function loadHub(fresh = false): Promise<{ data: HubDoc | null; etag: string | null }> {
  if (fresh) cache = null;
  if (cache && Date.now() - cache.at < FRESH_MS) return cache;
  const res = await readTagged<HubDoc>(HUB_PATH, cache?.etag ?? undefined);
  cache = res.unchanged && cache ? { ...cache, at: Date.now() } : { data: res.data, etag: res.etag, at: Date.now() };
  return cache;
}

/** The hub as stored, every part present. */
export async function readHub(fresh = false) {
  const { data } = await loadHub(fresh);
  return data ? normalizeDoc(data) : emptyDoc();
}

export class HubBusy extends Error {}

/** What a change function answers: the changes, nothing to do, or "look at what's really stored first". */
type Change<T> = { ops: Omit<HubOps, "gen">; result: T } | null | "reread";

/**
 * Applies changes worked out from the current hub. `make` sees the stored
 * copy and returns the changes (or null for none); when someone else wrote
 * meanwhile it runs again against the newer copy, so its checks (a link
 * already submitted, a budget already spent) always hold.
 */
export async function changeHub<T>(
  make: (doc: HubDoc, info: { stored: boolean; fresh: boolean }) => Change<T>,
): Promise<{ doc: HubDoc; etag: string | null; result: T | null }> {
  let last: unknown;
  let fresh = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      // The first try may start from memory (a stale copy just fails the
      // write below); every retry reads what's really stored.
      const { data, etag } = await loadHub(fresh);
      const doc = data ? normalizeDoc(data) : emptyDoc();
      const change = make(doc, { stored: !!data, fresh });
      if (change === "reread" && !fresh) {
        fresh = true;
        continue;
      }
      if (!change || change === "reread") return { doc, etag, result: null };
      const next = applyOps(doc, { gen: doc.gen, ...change.ops });
      const written = await writeTagged(HUB_PATH, next, etag);
      cache = { data: next, etag: written, at: Date.now() };
      return { doc: next, etag: written, result: change.result };
    } catch (err) {
      last = err;
      if (!(err instanceof WriteConflict)) throw err;
      fresh = true;
      // Spread the retries out so the savers stop colliding.
      await new Promise((r) => setTimeout(r, Math.random() * Math.min(1500, 100 * 2 ** attempt)));
    }
  }
  throw last instanceof WriteConflict ? new HubBusy("too many saves at once") : last;
}

/** A browser's own changes, made against `ops.gen`. */
export async function saveOps(ops: HubOps) {
  const { gen, ...rest } = ops;
  const out = await changeHub((doc, { stored }) => {
    // Made before a reset or restore: the browser adopts the new hub instead,
    // once we're sure against what's stored rather than a copy in memory.
    if (stored && gen !== doc.gen && !ops.reset) return "reread";
    return { ops: rest, result: true };
  });
  return { ...out, stale: out.result === null };
}
