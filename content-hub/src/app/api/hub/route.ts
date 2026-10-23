import { connection } from "next/server";
import { readTagged, writeTagged, WriteConflict } from "@/lib/footage/store";
import { applyOps, cleanOps, emptyDoc, HUB_PATH, type HubDoc } from "@/lib/hubsync";

// Every open tab checks in about once a minute, and each Blob read counts
// against the plan's monthly allowance. One server instance answers those
// checks from memory for a few seconds instead of asking Blob each time; a
// copy this old is never a problem because browsers ignore anything older
// than what they already have (HubDoc.rev).
const FRESH_MS = 20_000;
let cache: { data: HubDoc | null; etag: string | null; at: number } | null = null;

async function load(): Promise<{ data: HubDoc | null; etag: string | null }> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache;
  const res = await readTagged<HubDoc>(HUB_PATH, cache?.etag ?? undefined);
  cache = res.unchanged && cache ? { ...cache, at: Date.now() } : { data: res.data, etag: res.etag, at: Date.now() };
  return cache;
}

/** The shared hub. `?since=<etag>` answers { unchanged: true } when nothing moved. */
export async function GET(req: Request) {
  await connection();
  const since = new URL(req.url).searchParams.get("since");
  try {
    const { data, etag } = await load();
    if (since && etag === since) return Response.json({ unchanged: true, etag });
    return Response.json({ doc: data ?? emptyDoc(), etag });
  } catch (err) {
    return Response.json({ error: `Couldn't read the hub: ${(err as Error).message}` }, { status: 500 });
  }
}

/**
 * One browser's changes. Read, merge, write only if nobody wrote in between,
 * else read again: two people saving at once both land. If it still can't get
 * a turn, the browser keeps the changes and tries again shortly.
 */
export async function POST(req: Request) {
  const ops = cleanOps(await req.json().catch(() => null));
  if (!ops) return Response.json({ error: "Bad request." }, { status: 400 });

  let last: unknown;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      // The first try may start from memory (a stale copy just fails the
      // write below); every retry reads what's really stored.
      if (attempt > 0) cache = null;
      const { data, etag } = await load();
      const doc = data ?? emptyDoc();
      // Made before a reset or restore: the browser adopts the new hub instead.
      if (data && ops.gen !== doc.gen && !ops.reset) {
        if (attempt === 0) continue; // be sure against the stored copy first
        return Response.json({ doc, etag, stale: true });
      }
      const next = applyOps(doc, ops);
      const written = await writeTagged(HUB_PATH, next, etag);
      cache = { data: next, etag: written, at: Date.now() };
      return Response.json({ doc: next, etag: written });
    } catch (err) {
      last = err;
      if (!(err instanceof WriteConflict)) break;
      // Spread the retries out so the savers stop colliding.
      await new Promise((r) => setTimeout(r, Math.random() * Math.min(1500, 100 * 2 ** attempt)));
    }
  }
  const why = last instanceof WriteConflict ? "too many saves at once" : (last as Error)?.message;
  return Response.json({ error: `Couldn't save to the hub: ${why}` }, { status: 503 });
}
