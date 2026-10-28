// Clipping: the rules for checking a clipper's posts and paying them. Shared
// by the clipper portal's server routes and the Clipping screen, so the
// portal shows a clipper exactly what the review screen will work out.
//
// Only views from the United States are paid. Views are checked against
// proof (screenshots of the post's insights, read by Claude, or later the
// platform's own numbers), and the patterns that bought views leave behind
// are flagged before anything is approved: engagement far below the views,
// views that vanish when the platform cleans them out, an account based
// abroad, a brand-new account with a huge number, the same link twice.
import type { Account, Clipper, Drop, Payout, Platform, Submission, ViewSnapshot } from "./types";

/** Days after posting before a post can be paid: time for fake views to be cleaned out and show. */
export const HOLD_DAYS = 7;
/** Below this share of US viewers, the post is flagged (it's still paid on its US share). */
export const US_SHARE_FLAG = 0.5;
const DAY = 86_400_000;

export const DEFAULT_RULES = `- Post the clip as it is, or with one of the hooks given. Don't change what's said.
- Post from accounts you've added here, and keep them based in the United States.
- You're paid per 1,000 views from the United States only, after ${HOLD_DAYS} days, once the numbers are checked.
- Submit the post's link and screenshots of its insights: the views, and where the viewers are from.
- Never buy views, likes or followers, or use bots or engagement groups. Bought views get the post rejected, and the account removed.`;

const US = new Set(["united states", "united states of america", "usa", "us", "u.s.", "u.s.a.", "america"]);
export const isUS = (country?: string) => !!country && US.has(country.trim().toLowerCase());

// ------------------------------------------------------------------ links

const HOSTS: { re: RegExp; platform: Platform }[] = [
  { re: /(^|\.)instagram\.com$/, platform: "instagram" },
  { re: /(^|\.)tiktok\.com$/, platform: "tiktok" },
  { re: /(^|\.)(youtube\.com|youtu\.be)$/, platform: "youtube" },
  { re: /(^|\.)(facebook\.com|fb\.watch)$/, platform: "facebook" },
  { re: /(^|\.)linkedin\.com$/, platform: "linkedin" },
  { re: /(^|\.)(x\.com|twitter\.com)$/, platform: "x" },
  { re: /(^|\.)threads\.(net|com)$/, platform: "threads" },
];

/** The platform a post link belongs to, or null if it isn't a post link we know. */
export function platformOfUrl(raw: string): Platform | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return HOSTS.find((h) => h.re.test(u.hostname.toLowerCase()))?.platform ?? null;
  } catch {
    return null;
  }
}

/** One spelling per post: no query string, no trailing slash, no "www.", so a link can't be submitted twice. */
export function normalizeUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    return `${u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

// ------------------------------------------------------------------ numbers

export const sortedSnaps = (s: Pick<Submission, "snapshots">) => [...(s.snapshots ?? [])].sort((a, b) => a.at - b.at);

/** The latest reading of each number (a later screenshot may show views but not countries). */
export function latest(s: Pick<Submission, "snapshots">): Partial<ViewSnapshot> {
  const out: Partial<ViewSnapshot> = {};
  for (const snap of sortedSnaps(s)) {
    for (const [k, v] of Object.entries(snap)) if (v != null && k !== "proofs" && k !== "concerns" && k !== "source") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export const effectiveCpm = (clipper?: Pick<Clipper, "cpm">, drop?: Pick<Drop, "cpm">) => drop?.cpm ?? clipper?.cpm ?? 0;

/** What a post is worth as it stands: US views at the clipper's (or clip's) rate, capped. */
export function estimate(s: Submission, clipper?: Clipper, drop?: Drop) {
  const n = latest(s);
  const views = n.views ?? 0;
  const usShare = n.usShare;
  const usViews = usShare == null ? 0 : Math.round(views * usShare);
  let amount = (usViews / 1000) * effectiveCpm(clipper, drop);
  if (drop?.capPerPost != null) amount = Math.min(amount, drop.capPerPost);
  return { views, usShare, usViews, amount: Math.round(amount * 100) / 100 };
}

/** When the post can be paid: HOLD_DAYS after it went up. */
export const payableFrom = (s: Pick<Submission, "postedAt">) => s.postedAt + HOLD_DAYS * DAY;

/** Money already committed to a clip: approved and paid posts. */
export const dropSpent = (dropId: string, subs: Submission[]) =>
  subs.filter((s) => s.dropId === dropId && (s.status === "approved" || s.status === "paid")).reduce((n, s) => n + (s.amount ?? 0), 0);

// ------------------------------------------------------------------ checks

export type FlagLevel = "high" | "medium" | "low";
export interface Flag {
  id: string;
  level: FlagLevel;
  text: string;
}

/** Everything that doesn't look right about a post, worst first. */
export function flagsFor(s: Submission, ctx: { submissions: Submission[]; accounts: Account[] }, now = Date.now()): Flag[] {
  const flags: Flag[] = [];
  const snaps = sortedSnaps(s);
  const n = latest(s);
  const account = ctx.accounts.find((a) => a.id === s.accountId);
  const views = n.views ?? 0;

  const dupes = ctx.submissions.filter((o) => o.id !== s.id && normalizeUrl(o.url) === normalizeUrl(s.url));
  if (dupes.length) flags.push({ id: "duplicate", level: "high", text: "This link was submitted before." });

  // Platforms clean out fake views after a while; the count going down is the clearest sign.
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1].views;
    const b = snaps[i].views;
    if (a != null && b != null && b < a * 0.95) {
      flags.push({ id: "views-dropped", level: "high", text: `Views went down from ${a.toLocaleString()} to ${b.toLocaleString()}: the platform removed views it didn't count as real.` });
      break;
    }
  }

  // Bought views come with almost no likes, comments or shares.
  const engaged = (n.likes ?? 0) + (n.comments ?? 0) + (n.shares ?? 0);
  if (views >= 5000 && n.likes != null && engaged / views < 0.004) {
    flags.push({ id: "low-engagement", level: "high", text: `Only ${engaged.toLocaleString()} likes, comments and shares on ${views.toLocaleString()} views (${((engaged / views) * 100).toFixed(2)}%). Real views usually bring 1% or more.` });
  }

  if (account?.basedIn && !isUS(account.basedIn)) flags.push({ id: "account-abroad", level: "high", text: `The account is based in ${account.basedIn}.` });

  if (n.usShare == null) flags.push({ id: "us-unknown", level: "medium", text: "No country breakdown yet, so no US views can be counted." });
  else if (n.usShare < 0.2) flags.push({ id: "low-us", level: "high", text: `Only ${Math.round(n.usShare * 100)}% of viewers are in the United States.` });
  else if (n.usShare < US_SHARE_FLAG) flags.push({ id: "low-us", level: "medium", text: `${Math.round(n.usShare * 100)}% of viewers are in the United States.` });

  if (!snaps.some((x) => x.proofs?.length)) flags.push({ id: "no-proof", level: "medium", text: "No screenshots: the numbers are only as typed." });

  if (n.handle && account && n.handle.replace(/^@/, "").toLowerCase() !== account.handle.toLowerCase()) {
    flags.push({ id: "handle-mismatch", level: "medium", text: `The screenshot shows @${n.handle.replace(/^@/, "")}, not @${account.handle}.` });
  }

  // A huge number on an account that's days old is how bought views usually start.
  const joined = account?.joined ? Date.parse(`1 ${account.joined}`) : NaN;
  if (Number.isFinite(joined) && s.postedAt - joined < 30 * DAY && views >= 50_000) {
    flags.push({ id: "new-account", level: "medium", text: `${views.toLocaleString()} views on an account that joined ${account!.joined}.` });
  }

  // All the views in the first day, then nothing, over several days.
  if (snaps.length >= 2) {
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    if (first.views && last.views && first.at - s.postedAt < 1.5 * DAY && last.at - first.at > 3 * DAY && first.views >= 50_000 && last.views < first.views * 1.05) {
      flags.push({ id: "front-loaded", level: "medium", text: "Every view came in the first day, then none for days: real reach keeps trickling in." });
    }
  }

  for (const c of snaps.flatMap((x) => x.concerns ?? [])) flags.push({ id: "concern", level: "medium", text: c });

  if (!account) flags.push({ id: "no-account", level: "low", text: "Not linked to one of their accounts." });
  else if (!account.basedIn) flags.push({ id: "account-unknown", level: "low", text: "Where the account is based hasn't been shown yet." });
  if (now < payableFrom(s)) flags.push({ id: "holding", level: "low", text: `Can be paid from ${new Date(payableFrom(s)).toLocaleDateString()}.` });

  const order: Record<FlagLevel, number> = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.level] - order[b.level]);
}

/** The worst flag's level, ignoring "can be paid from" notes. */
export function riskOf(flags: Flag[]): FlagLevel {
  const real = flags.filter((f) => f.id !== "holding");
  return real.some((f) => f.level === "high") ? "high" : real.some((f) => f.level === "medium") ? "medium" : "low";
}

/** A link a clipper can't guess: 24 random characters. */
export function newKey() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

// ------------------------------------------------------------------ the owner's numbers

/** One clipper's month (or any range): what they posted, what counted, what they're owed. */
export function clipperStats(c: Clipper, ctx: { submissions: Submission[]; accounts: Account[]; drops: Drop[] }, since = 0) {
  const subs = ctx.submissions.filter((s) => s.clipperId === c.id && s.postedAt >= since);
  const accounts = ctx.accounts.filter((a) => a.clipperId === c.id);
  const counted = subs.filter((s) => s.status === "approved" || s.status === "paid");
  const views = subs.reduce((n, s) => n + (latest(s).views ?? 0), 0);
  const usViews = counted.reduce((n, s) => n + (s.usViews ?? 0), 0);
  const flagged = subs.filter((s) => riskOf(flagsFor(s, ctx)) === "high").length;
  return {
    posts: subs.length,
    accounts: accounts.length,
    usAccounts: accounts.filter((a) => isUS(a.basedIn)).length,
    views,
    usViews,
    flagged,
    rejected: subs.filter((s) => s.status === "rejected").length,
    earned: counted.reduce((n, s) => n + (s.amount ?? 0), 0),
    owed: ctx.submissions.filter((s) => s.clipperId === c.id && s.status === "approved").reduce((n, s) => n + (s.amount ?? 0), 0),
    pending: subs.filter((s) => s.status === "pending").length,
  };
}

export const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A spreadsheet of payouts for whoever sends the money. */
export function payoutsCsv(payouts: Payout[], clippers: Clipper[]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = payouts.map((p) => {
    const c = clippers.find((x) => x.id === p.clipperId);
    return [c?.name ?? "", c?.contact ?? "", c?.payoutNote ?? "", p.amount.toFixed(2), p.usViews, p.submissionIds.length, p.status, p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : ""].map(esc).join(",");
  });
  return ["Clipper,Contact,How to pay,Amount (USD),US views,Posts,Status,Paid on", ...rows].join("\n");
}
