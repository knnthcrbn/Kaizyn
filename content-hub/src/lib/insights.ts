// What's working: the numbers typed in on each post, compared by what the
// video was (hook type, pillar, length, platform, when it went out). Medians,
// not averages, so one viral post doesn't make its whole group look good.
// The same summary goes to Claude with every request, which is how results
// feed back into the hooks and scripts it writes.
import { hookTypeName } from "./hookTypes";
import { pillarLabel, platformLabel } from "./meta";
import { editLength, withDefaults, type Edit } from "./studio/types";
import type { Account, ContentItem, Post, Test, TestMetric } from "./types";

export const METRIC_INFO: Record<TestMetric, { label: string; short: string; pct?: boolean }> = {
  views: { label: "Views", short: "views" },
  avgWatch: { label: "Avg % watched", short: "% watched", pct: true },
  shares: { label: "Shares", short: "shares" },
  saves: { label: "Saves", short: "saves" },
  follows: { label: "Follows", short: "follows" },
};

export const metricOf = (p: Post, m: TestMetric) => p.results?.[m];

export const measured = (posts: Post[]) => posts.filter((p) => p.status === "posted" && p.results);

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function compact(n: number, pct = false) {
  if (pct) return `${Math.round(n)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

// ------------------------------------------------------------------ what each post was

export interface PostFacts {
  post: Post;
  card?: ContentItem;
  account?: Account;
  /** Seconds, from the card's edit, else its script at 150 words a minute. */
  length?: number;
}

export function factsFor(posts: Post[], items: ContentItem[], edits: Edit[], accounts: Account[]): PostFacts[] {
  const cards = new Map(items.map((i) => [i.id, i]));
  const accs = new Map(accounts.map((a) => [a.id, a]));
  const lengths = new Map<string, number>();
  for (const e of edits) if (e.cardId && e.clips?.length) lengths.set(e.cardId, editLength(withDefaults(e)));
  return posts.map((post) => {
    const card = post.cardId ? cards.get(post.cardId) : undefined;
    const words = card?.script.trim() ? card.script.trim().split(/\s+/).length : 0;
    return {
      post,
      card,
      account: post.accountId ? accs.get(post.accountId) : undefined,
      length: (card && lengths.get(card.id)) ?? (words ? (words / 150) * 60 : undefined),
    };
  });
}

const lengthBucket = (s?: number) =>
  s == null ? undefined : s < 15 ? "Under 15s" : s < 30 ? "15–30s" : s < 60 ? "30–60s" : s < 90 ? "60–90s" : s < 180 ? "1.5–3 min" : "Over 3 min";

const LENGTH_ORDER = ["Under 15s", "15–30s", "30–60s", "60–90s", "1.5–3 min", "Over 3 min"];

const timeBucket = (t: number) => {
  const h = new Date(t).getHours();
  return h < 5 ? "Night (9pm–5am)" : h < 12 ? "Morning (5am–noon)" : h < 17 ? "Afternoon (noon–5pm)" : h < 21 ? "Evening (5–9pm)" : "Night (9pm–5am)";
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface Dimension {
  id: string;
  label: string;
  of: (f: PostFacts) => string | undefined;
  /** Fixed order for groups that have one (lengths, days); otherwise best first. */
  order?: string[];
}

export const DIMENSIONS: Dimension[] = [
  { id: "hook", label: "Hook type", of: (f) => hookTypeName(f.card?.hookType) },
  { id: "pillar", label: "Pillar", of: (f) => (f.card ? pillarLabel(f.card.pillar) : undefined) },
  { id: "length", label: "Length", of: (f) => lengthBucket(f.length), order: LENGTH_ORDER },
  { id: "platform", label: "Platform", of: (f) => platformLabel(f.post.platform) },
  { id: "time", label: "Time posted", of: (f) => timeBucket(f.post.at) },
  { id: "day", label: "Day posted", of: (f) => DAYS[new Date(f.post.at).getDay()], order: [...DAYS.slice(1), DAYS[0]] },
  { id: "overlay", label: "Text on screen", of: (f) => (f.card ? (f.card.overlay.trim() ? "With overlay text" : "No overlay text") : undefined) },
  { id: "sound", label: "Trending sound", of: (f) => (f.post.soundId ? "Trending sound" : "Own audio") },
  { id: "account", label: "Account type", of: (f) => (f.account ? (f.account.kind === "main" ? "Main account" : "Clipping page") : undefined) },
  { id: "trial", label: "Trial reel", of: (f) => (f.post.platform === "instagram" ? (f.post.trial ? "Trial reel" : "Regular reel") : undefined) },
];

export interface Group {
  key: string;
  n: number;
  median: number;
}

/** Groups by one dimension, for one metric, best first (or in the dimension's own order). */
export function breakdown(facts: PostFacts[], dim: Dimension, metric: TestMetric): Group[] {
  const groups = new Map<string, number[]>();
  for (const f of facts) {
    const key = dim.of(f);
    const v = metricOf(f.post, metric);
    if (!key || v == null) continue;
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  const out = [...groups].map(([key, vs]) => ({ key, n: vs.length, median: median(vs) }));
  return dim.order ? out.sort((a, b) => dim.order!.indexOf(a.key) - dim.order!.indexOf(b.key)) : out.sort((a, b) => b.median - a.median);
}

/** A group needs this many posts before it's called a pattern rather than luck. */
export const ENOUGH = 3;

// ------------------------------------------------------------------ tests

/** The variant ahead on the test's metric, once every variant has numbers. */
export function testLeader(test: Test, posts: Post[]) {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const scored = test.variants.map((v) => {
    const p = v.postId ? byId.get(v.postId) : undefined;
    return { v, value: p ? metricOf(p, test.metric) : undefined };
  });
  if (scored.some((s) => s.value == null) || scored.length < 2) return null;
  const sorted = [...scored].sort((a, b) => b.value! - a.value!);
  const [a, b] = sorted;
  return { variant: a.v, value: a.value!, margin: b.value ? (a.value! - b.value!) / b.value! : 1 };
}

// ------------------------------------------------------------------ for Claude

/**
 * What has worked so far, in a few lines for Claude's context. Empty until a
 * handful of posts have numbers: early noise would only mislead it.
 */
export function performanceSummary(facts: PostFacts[], tests: Test[]): string {
  const withViews = facts.filter((f) => metricOf(f.post, "views") != null);
  if (withViews.length < ENOUGH) return "";
  const lines: string[] = [`${withViews.length} posts have results. Median views ${compact(median(withViews.map((f) => f.post.results!.views!)))}.`];
  for (const id of ["hook", "pillar", "length", "time", "platform"]) {
    const dim = DIMENSIONS.find((d) => d.id === id)!;
    const groups = breakdown(withViews, dim, "views").filter((g) => g.n >= 2);
    if (groups.length < 2) continue;
    const best = [...groups].sort((a, b) => b.median - a.median);
    lines.push(
      `${dim.label}: ${best
        .slice(0, 4)
        .map((g) => `${g.key} ${compact(g.median)} median (${g.n})`)
        .join("; ")}.`,
    );
  }
  const top = [...withViews].sort((a, b) => b.post.results!.views! - a.post.results!.views!).slice(0, 5);
  lines.push(
    "Best posts:\n" +
      top
        .map((f) => {
          const hook = f.card ? f.card.hooks[f.card.chosenHook] || f.card.title : f.post.caption.slice(0, 80);
          const r = f.post.results!;
          return `- "${hook}" (${f.card ? pillarLabel(f.card.pillar) : "no card"}, ${f.post.platform}): ${compact(r.views!)} views${r.avgWatch != null ? `, ${Math.round(r.avgWatch)}% watched` : ""}${r.shares != null ? `, ${compact(r.shares)} shares` : ""}`;
        })
        .join("\n"),
  );
  const learned = tests.filter((t) => t.status === "done" && t.learned.trim()).slice(0, 5);
  if (learned.length) lines.push("Trial reel tests learned:\n" + learned.map((t) => `- ${t.name}: ${t.learned.trim()}`).join("\n"));
  return lines.join("\n");
}
