import { clipperFor, parseImages, recordId, storeProofs, tooMany } from "@/lib/clipServer";
import { platformOfUrl } from "@/lib/clipping";
import { changeHub } from "@/lib/hubServer";
import { readAccountProof } from "@/lib/proofs";
import type { Account, Platform } from "@/lib/types";

export const maxDuration = 60;

const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x", "threads"];

/**
 * A clipper adds an account they run, with screenshots of its profile and
 * "About this account" (where it's based, when it joined). Claude reads them;
 * the owner confirms on the review screen.
 */
export async function POST(req: Request) {
  if (tooMany(req)) return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  const found = await clipperFor(req, { active: true });
  if (found instanceof Response) return found;
  const { clipper } = found;
  const body = (await req.json().catch(() => null)) as { platform?: string; handle?: string; proofs?: unknown } | null;
  const raw = (body?.handle ?? "").trim();
  const platform = (PLATFORMS.includes(body?.platform as Platform) ? body!.platform : platformOfUrl(raw)) as Platform | null;
  const handle = raw
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
  if (!platform) return Response.json({ error: "Pick the platform." }, { status: 400 });
  if (!/^[\w.\-]{1,60}$/.test(handle)) return Response.json({ error: "That handle doesn't look right." }, { status: 400 });
  const images = parseImages(body?.proofs);
  if (typeof images === "string") return Response.json({ error: images }, { status: 400 });

  const read = await readAccountProof(images, { handle, platform }).catch(() => ({
    handle: undefined,
    basedIn: undefined,
    joined: undefined,
    followers: undefined,
    concerns: ["The screenshots couldn't be read automatically, so where it's based needs checking by eye."],
  }));
  const proofs = await storeProofs(clipper.id, images);
  if (read.handle && read.handle.toLowerCase() !== handle.toLowerCase()) read.concerns.push(`The screenshots show @${read.handle}, not @${handle}.`);

  let taken = false;
  const { result } = await changeHub<Account>((doc) => {
    const same = doc.accounts.find((a) => a.platform === platform && a.handle.toLowerCase() === handle.toLowerCase());
    taken = !!same && same.clipperId !== clipper.id;
    if (taken) return null;
    const now = Date.now();
    const account: Account = {
      ...(same ?? { id: recordId(), createdAt: now, pillars: [], active: true, kind: "clipping" as const }),
      platform,
      handle,
      group: same?.group || `Clipper: ${clipper.name}`,
      clipperId: clipper.id,
      basedIn: read.basedIn ?? same?.basedIn,
      joined: read.joined ?? same?.joined,
      followers: read.followers ?? same?.followers,
      proof: proofs[0],
      // New proof means it needs checking again.
      verifiedAt: undefined,
      notes: read.concerns.length ? `From the screenshots: ${read.concerns.join(" ")}` : (same?.notes ?? ""),
      updatedAt: now,
    } as Account;
    return { ops: { upserts: { accounts: [account] } }, result: account };
  });
  if (taken) return Response.json({ error: "That account is already registered to someone else." }, { status: 409 });
  return Response.json({ ok: true, account: { handle, platform, basedIn: result?.basedIn, joined: result?.joined } });
}
