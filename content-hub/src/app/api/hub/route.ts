import { connection } from "next/server";
import { HubBusy, loadHub, saveOps } from "@/lib/hubServer";
import { cleanOps, emptyDoc, normalizeDoc } from "@/lib/hubsync";

/** The shared hub. `?since=<etag>` answers { unchanged: true } when nothing moved. */
export async function GET(req: Request) {
  await connection();
  const since = new URL(req.url).searchParams.get("since");
  try {
    const { data, etag } = await loadHub();
    if (since && etag === since) return Response.json({ unchanged: true, etag });
    return Response.json({ doc: data ? normalizeDoc(data) : emptyDoc(), etag });
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
  try {
    const { doc, etag, stale } = await saveOps(ops);
    return Response.json(stale ? { doc, etag, stale: true } : { doc, etag });
  } catch (err) {
    const why = err instanceof HubBusy ? "too many saves at once" : (err as Error)?.message;
    return Response.json({ error: `Couldn't save to the hub: ${why}` }, { status: 503 });
  }
}
