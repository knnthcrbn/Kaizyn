// The clipper portal's server side. A clipper has no hub sign-in: their
// private link carries a key, and every route here finds the clipper by that
// key and answers with their own clips, accounts, posts and earnings only.
// The hub itself never leaves the server.
import { DEFAULT_RULES, effectiveCpm, estimate, payableFrom } from "./clipping";
import { readJSON, writeBytes } from "./footage/store";
import { PATHS, type Footage } from "./footage/types";
import { readHub } from "./hubServer";
import type { HubDoc } from "./hubsync";
import { readPostProof, type Image } from "./proofs";
import type { Clipper, ViewSnapshot } from "./types";

export const recordId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 14);

const keyOf = (req: Request) => req.headers.get("x-clip-key") ?? new URL(req.url).searchParams.get("k") ?? "";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** The clipper this request's key belongs to, or the response to send instead. */
export async function clipperFor(req: Request, opts: { active?: boolean; fresh?: boolean } = {}): Promise<{ doc: HubDoc; clipper: Clipper } | Response> {
  const key = keyOf(req);
  if (key.length < 16) return fail(401, "This link is missing its key. Use the full link you were sent.");
  const doc = await readHub(opts.fresh);
  const clipper = doc.clippers.find((c) => c.key === key && c.status !== "removed");
  if (!clipper) return fail(403, "This link doesn't work any more. Ask for a new one.");
  if (opts.active && clipper.status !== "active") return fail(403, "Your clipping account is paused, so new posts can't be added. Ask what's up.");
  return { doc, clipper };
}

// A link someone shared, or a script hammering the routes, gets slowed down.
const hits = new Map<string, number[]>();
export function tooMany(req: Request, max = 40, windowMs = 10 * 60_000) {
  const key = keyOf(req) || "none";
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE = 2_000_000; // base64 characters, about 1.5 MB

/** Screenshots sent as data URLs: up to four, each a reasonable size. */
export function parseImages(list: unknown): Image[] | string {
  if (!Array.isArray(list) || !list.length) return "Add at least one screenshot.";
  if (list.length > 4) return "Four screenshots at most.";
  const out: Image[] = [];
  for (const raw of list) {
    const m = typeof raw === "string" ? raw.match(DATA_URL) : null;
    if (!m) return "Screenshots must be images (JPEG, PNG or WebP).";
    if (m[2].length > MAX_IMAGE) return "One of the screenshots is too big.";
    out.push({ mediaType: m[1] as Image["mediaType"], data: m[2] });
  }
  return out;
}

export const isProofPath = (p: string) => /^clipping\/proof\/[\w-]+\/[\w.\-]+$/.test(p) && !p.includes("..");

/** Keeps the screenshots privately, so the review screen can show them. */
export async function storeProofs(clipperId: string, images: Image[]) {
  const stamp = Date.now().toString(36);
  return Promise.all(
    images.map(async (img, i) => {
      const ext = img.mediaType === "image/png" ? "png" : img.mediaType === "image/webp" ? "webp" : "jpg";
      const p = `clipping/proof/${clipperId}/${stamp}-${i}-${recordId().slice(0, 6)}.${ext}`;
      await writeBytes(p, Buffer.from(img.data, "base64"), img.mediaType);
      return p;
    }),
  );
}

export type Typed = { views?: number; likes?: number; comments?: number; shares?: number; saves?: number; usPercent?: number };

/** Numbers the clipper typed, used only where the screenshots didn't show one. */
function typedNumbers(t?: Typed) {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);
  const us = typeof t?.usPercent === "number" && t.usPercent >= 0 && t.usPercent <= 100 ? t.usPercent / 100 : undefined;
  return { views: n(t?.views), likes: n(t?.likes), comments: n(t?.comments), shares: n(t?.shares), saves: n(t?.saves), usShare: us };
}

/** Reads the screenshots into one reading, falling back on what was typed. */
export async function readingFrom(clipperId: string, images: Exclude<ReturnType<typeof parseImages>, string>, expect: { platform: string; handle?: string }, typed?: Typed) {
  const proofs = await storeProofs(clipperId, images);
  const t = typedNumbers(typed);
  try {
    const read = await readPostProof(images, expect);
    const snap: ViewSnapshot = { ...read, at: Date.now(), source: "screenshot", proofs };
    // Fill gaps from what was typed, and say so when the two disagree.
    for (const k of ["views", "likes", "comments", "shares", "saves", "usShare"] as const) {
      if (snap[k] == null && t[k] != null) snap[k] = t[k];
      else if (snap[k] != null && t[k] != null && Math.abs(snap[k]! - t[k]!) > Math.max(1, snap[k]! * 0.05)) {
        snap.concerns = [...(snap.concerns ?? []), `Typed ${k === "usShare" ? "US share" : k} (${k === "usShare" ? `${Math.round(t[k]! * 100)}%` : t[k]!.toLocaleString()}) doesn't match the screenshot (${k === "usShare" ? `${Math.round(snap[k]! * 100)}%` : snap[k]!.toLocaleString()}).`];
      }
    }
    return snap;
  } catch {
    return { ...t, at: Date.now(), source: "manual", proofs, concerns: ["The screenshots couldn't be read automatically: the numbers are as typed, so check them against the screenshots."] } satisfies ViewSnapshot;
  }
}

const rotate = <T,>(list: T[], by: number) => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list);

/** Everything a clipper's portal shows: their clips to post, accounts, posts and money. */
export async function portalView(doc: HubDoc, clipper: Clipper) {
  // Each clipper gets the hooks and captions in a different order, so a hundred pages don't post the same words.
  const order = [...doc.clippers].sort((a, b) => a.createdAt - b.createdAt).findIndex((c) => c.id === clipper.id);
  const mine = doc.submissions.filter((s) => s.clipperId === clipper.id).sort((a, b) => b.createdAt - a.createdAt);
  const drops = await Promise.all(
    doc.drops
      .filter((d) => d.status === "live")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(async (d) => {
        const f = d.footageId ? await readJSON<Footage>(PATHS.meta(d.footageId)).catch(() => null) : null;
        return {
          id: d.id,
          title: d.title,
          brief: d.brief,
          platforms: d.platforms,
          hooks: rotate(d.hooks, Math.max(0, order)),
          captions: rotate(d.captions, Math.max(0, order)),
          cpm: effectiveCpm(clipper, d),
          capPerPost: d.capPerPost,
          posted: mine.filter((s) => s.dropId === d.id).length,
          video: f?.uploaded ? { name: f.file.name, duration: f.duration, width: f.width, height: f.height, poster: f.poster, size: f.file.size } : null,
        };
      }),
  );
  const posts = mine.map((s) => {
    const drop = doc.drops.find((d) => d.id === s.dropId);
    const e = estimate(s, clipper, drop);
    return {
      id: s.id,
      dropTitle: drop?.title,
      accountId: s.accountId,
      platform: s.platform,
      url: s.url,
      postedAt: s.postedAt,
      status: s.status,
      views: e.views,
      usShare: e.usShare,
      usViews: s.status === "approved" || s.status === "paid" ? (s.usViews ?? e.usViews) : e.usViews,
      amount: s.status === "approved" || s.status === "paid" ? (s.amount ?? 0) : e.amount,
      reviewNote: s.reviewNote,
      payableFrom: payableFrom(s),
      readings: s.snapshots.length,
    };
  });
  const sum = (status: string) => posts.filter((p) => p.status === status).reduce((n, p) => n + p.amount, 0);
  // A leaderboard by verified US views this month; others shown by first name only.
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const board = doc.clippers
    .filter((c) => c.status !== "removed")
    .map((c) => ({
      id: c.id,
      name: c.id === clipper.id ? "You" : c.name.split(/\s+/)[0],
      usViews: doc.submissions
        .filter((s) => s.clipperId === c.id && (s.status === "approved" || s.status === "paid") && s.postedAt >= monthStart)
        .reduce((n, s) => n + (s.usViews ?? 0), 0),
    }))
    .sort((a, b) => b.usViews - a.usViews);
  return {
    clipper: { name: clipper.name, cpm: clipper.cpm, status: clipper.status, acceptedRulesAt: clipper.acceptedRulesAt },
    rules: DEFAULT_RULES,
    drops,
    accounts: doc.accounts
      .filter((a) => a.clipperId === clipper.id)
      .map((a) => ({ id: a.id, platform: a.platform, handle: a.handle, basedIn: a.basedIn, joined: a.joined, followers: a.followers, verified: !!a.verifiedAt, active: a.active })),
    posts,
    totals: { pending: sum("pending"), owed: sum("approved"), paid: sum("paid") },
    board: board.slice(0, 10).map(({ name, usViews }) => ({ name, usViews })),
    rank: board.findIndex((b) => b.id === clipper.id) + 1,
  };
}

export type PortalView = Awaited<ReturnType<typeof portalView>>;
