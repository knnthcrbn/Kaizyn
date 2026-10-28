import { clipperFor, parseImages, readingFrom, tooMany } from "@/lib/clipServer";
import { changeHub } from "@/lib/hubServer";

export const maxDuration = 60;

/**
 * New screenshots for a post already submitted: the numbers a week on, or the
 * country breakdown that was missing. An approved post goes back for review,
 * since what it's worth may have changed.
 */
export async function POST(req: Request) {
  if (tooMany(req)) return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  const found = await clipperFor(req, { active: true, fresh: true });
  if (found instanceof Response) return found;
  const { doc, clipper } = found;
  const body = (await req.json().catch(() => null)) as { submissionId?: string; proofs?: unknown; typed?: Record<string, number> } | null;
  const sub = doc.submissions.find((s) => s.id === body?.submissionId && s.clipperId === clipper.id);
  if (!sub) return Response.json({ error: "That post isn't one of yours." }, { status: 404 });
  if (sub.status === "paid" || sub.status === "rejected" || sub.payoutId) return Response.json({ error: "That post is settled; it can't change now." }, { status: 400 });
  const images = parseImages(body?.proofs);
  if (typeof images === "string") return Response.json({ error: images }, { status: 400 });
  const account = doc.accounts.find((a) => a.id === sub.accountId);
  const snap = await readingFrom(clipper.id, images, { platform: sub.platform, handle: account?.handle }, body?.typed);
  await changeHub((d) => {
    const cur = d.submissions.find((s) => s.id === sub.id);
    if (!cur || cur.status === "paid" || cur.payoutId) return null;
    return {
      ops: { upserts: { submissions: [{ ...cur, snapshots: [...cur.snapshots, snap], status: "pending", updatedAt: Date.now() }] } },
      result: true,
    };
  });
  return Response.json({ ok: true, views: snap.views, usShare: snap.usShare, concerns: snap.concerns ?? [] });
}
