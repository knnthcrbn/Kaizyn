import { clipperFor, parseImages, readingFrom, recordId, tooMany, type Typed } from "@/lib/clipServer";
import { normalizeUrl, platformOfUrl } from "@/lib/clipping";
import { changeHub } from "@/lib/hubServer";
import type { Submission } from "@/lib/types";

export const maxDuration = 60;

/** A clipper posted a clip: the link, which account, and screenshots of its insights. */
export async function POST(req: Request) {
  if (tooMany(req)) return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  const found = await clipperFor(req, { active: true, fresh: true });
  if (found instanceof Response) return found;
  const { doc, clipper } = found;
  if (!clipper.acceptedRulesAt) return Response.json({ error: "Read and accept the rules first." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { dropId?: string; accountId?: string; url?: string; postedAt?: number; proofs?: unknown; typed?: Typed } | null;
  const url = (body?.url ?? "").trim();
  const platform = platformOfUrl(url);
  if (!platform) return Response.json({ error: "Paste the link to the post itself (instagram.com/…, tiktok.com/…)." }, { status: 400 });
  const account = body?.accountId ? doc.accounts.find((a) => a.id === body.accountId && a.clipperId === clipper.id) : undefined;
  if (body?.accountId && !account) return Response.json({ error: "That account isn't one of yours." }, { status: 400 });
  if (account && account.platform !== platform) return Response.json({ error: `That link is ${platform}, but @${account.handle} is a ${account.platform} account.` }, { status: 400 });
  const drop = body?.dropId ? doc.drops.find((d) => d.id === body.dropId) : undefined;
  if (body?.dropId && !drop) return Response.json({ error: "That clip isn't available any more." }, { status: 400 });
  if (doc.submissions.some((s) => normalizeUrl(s.url) === normalizeUrl(url))) return Response.json({ error: "That post has already been submitted." }, { status: 409 });
  const images = parseImages(body?.proofs);
  if (typeof images === "string") return Response.json({ error: images }, { status: 400 });
  const postedAt = typeof body?.postedAt === "number" && body.postedAt > Date.now() - 90 * 86_400_000 && body.postedAt <= Date.now() + 3_600_000 ? body.postedAt : Date.now();

  const snap = await readingFrom(clipper.id, images, { platform, handle: account?.handle }, body?.typed);
  let dupe = false;
  const { result } = await changeHub<Submission>((d) => {
    // Checked again against what's stored: two tabs can't submit one link twice.
    dupe = d.submissions.some((s) => normalizeUrl(s.url) === normalizeUrl(url));
    if (dupe) return null;
    const now = Date.now();
    const sub: Submission = {
      id: recordId(),
      clipperId: clipper.id,
      dropId: drop?.id,
      accountId: account?.id,
      platform,
      url,
      postedAt,
      snapshots: [snap],
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    return { ops: { upserts: { submissions: [sub] } }, result: sub };
  });
  if (dupe) return Response.json({ error: "That post has already been submitted." }, { status: 409 });
  return Response.json({ ok: true, id: result?.id, views: snap.views, usShare: snap.usShare, concerns: snap.concerns ?? [] });
}
