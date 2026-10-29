"use client";

// The calendar's working parts: platforms, weeks, goal progress, staggered
// times for many accounts, and what happens when a post goes out. Screens call
// these instead of writing records directly, so a card always follows its
// posts (posted when the first one goes out, analysed once results are in).
import { PLATFORMS, platformLabel, stageIndex } from "./meta";
import { weekStart } from "./metrics";
import { dayKey, uid, useHub, type NewRecord } from "./store";
import type { Account, ContentItem, Goal, Pillar, Platform, Post, PostResults, PostVideo, Test, TestMetric } from "./types";

export { PLATFORMS, platformLabel };
export const platformHex = (p: Platform) => PLATFORMS.find((x) => x.id === p)?.hex ?? "#a1a1aa";

const DAY = 86_400_000;

/** A day key as a local Date at midnight. */
export const dayDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const dayOf = (t: number) => dayKey(new Date(t));

/** A day key plus "HH:MM" as a timestamp. */
export function atTime(key: string, time = "09:00") {
  const d = dayDate(key);
  const [h, m] = (time || "09:00").split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export const timeOf = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const clockLabel = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Same time of day, on another day: what dragging a post to a new day does. */
export function moveToDay(t: number, key: string) {
  const d = new Date(t);
  const next = dayDate(key);
  next.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return next.getTime();
}

/** Monday's day key for the week containing `t`. */
export const weekKey = (t: number) => dayKey(new Date(weekStart(t)));

export const weekDays = (start: number) => Array.from({ length: 7 }, (_, i) => dayKey(new Date(start + i * DAY + 3_600_000)));

export function weekLabel(key: string) {
  const a = dayDate(key);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${f(a)} – ${f(b)}`;
}

export const accountLabel = (a?: Account) => (a ? `@${a.handle}` : "");

/** "@name", "instagram.com/name", "https://www.tiktok.com/@name?x" -> "name". */
export function parseHandles(text: string) {
  return [
    ...new Set(
      text
        .split(/[\n,;\s]+/)
        .map((raw) =>
          raw
            .trim()
            .replace(/^https?:\/\//i, "")
            .replace(/^(www\.|m\.)/i, "")
            .replace(/^[a-z.]+\.(com|net)\/(channel\/|c\/|user\/)?/i, "")
            .replace(/[/?#].*$/, "")
            .replace(/^@/, ""),
        )
        .filter((h) => /^[\w.\-]{1,60}$/.test(h)),
    ),
  ];
}


// ------------------------------------------------------------------ goals

/** A goal's pillar comes from the post's card; a post with no card only counts toward "any". */
function matches(goal: Goal, post: Post, card?: ContentItem) {
  if (goal.platform !== "any" && goal.platform !== post.platform) return false;
  if (goal.pillar !== "any" && card?.pillar !== goal.pillar) return false;
  return true;
}

/**
 * How a week is going against a goal. A video counts once per platform,
 * however many accounts it went to: 100 clipping pages posting one reel is one
 * Instagram post toward the goal, not a hundred.
 */
export function goalProgress(goal: Goal, posts: Post[], items: ContentItem[], weekStartMs: number) {
  const end = weekStartMs + 7 * DAY;
  const cards = new Map(items.map((i) => [i.id, i]));
  const done = new Set<string>();
  const planned = new Set<string>();
  for (const p of posts) {
    if (p.at < weekStartMs || p.at >= end || p.status === "skipped") continue;
    if (!matches(goal, p, p.cardId ? cards.get(p.cardId) : undefined)) continue;
    const video = `${p.cardId ?? p.id}:${p.platform}`;
    if (p.status === "posted") done.add(video);
    else planned.add(video);
  }
  for (const v of done) planned.delete(v);
  return { target: goal.perWeek, done: done.size, planned: planned.size };
}

export function goalLabel(goal: Pick<Goal, "platform" | "pillar">, pillarName: (p: Pillar) => string) {
  const who = goal.platform === "any" ? "Any platform" : platformLabel(goal.platform);
  return goal.pillar === "any" ? who : `${pillarName(goal.pillar)} on ${who}`;
}

// ------------------------------------------------------------------ scheduling

/**
 * Times for posting one video to many accounts: the first at `start`, the
 * rest `gapMin` apart with up to `jitterMin` either way, so clipping pages
 * never post the same thing in the same minute or on a visible beat.
 *
 * Each post's jitter is its own, so two neighbours can lean towards each
 * other: ±5 on a 10-minute gap put two pages a minute apart. The jitter is
 * held to 30% of the gap, which keeps every pair at least 40% of it apart.
 */
export function staggerTimes(start: number, n: number, gapMin: number, jitterMin = 0, seed = 1) {
  let s = seed || 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const spread = Math.min(jitterMin, gapMin * 0.3);
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return start;
    const jitter = spread ? (rand() * 2 - 1) * spread : 0;
    // Whole minutes: a schedule reads "10:47", not "10:47:23".
    return start + Math.round(i * gapMin + jitter) * 60_000;
  });
}

export interface PlanInput {
  cardId?: string;
  /** Accounts to post to; platforms with no account set up yet can be posted to as "the platform". */
  targets: { platform: Platform; accountId?: string }[];
  start: number;
  gapMin: number;
  jitterMin: number;
  /** Caption per target, in the same order (variants rotate when there are fewer). */
  captions: string[];
  trial?: boolean;
  soundId?: string;
  testId?: string;
  variantId?: string;
  /** The exact file every one of these posts is made from. */
  video?: PostVideo;
}

/** Creates the planned posts; returns their ids. */
export function planPosts(p: PlanInput) {
  const times = staggerTimes(p.start, p.targets.length, p.gapMin, p.jitterMin, Math.round(p.start / 60_000));
  const records: NewRecord<"posts">[] = p.targets.map((t, i) => ({
    cardId: p.cardId,
    platform: t.platform,
    accountId: t.accountId,
    at: times[i],
    status: "planned",
    caption: p.captions.length ? p.captions[i % p.captions.length] : "",
    trial: p.trial || undefined,
    soundId: p.soundId,
    testId: p.testId,
    variantId: p.variantId,
    video: p.video,
  }));
  const ids = useHub.getState().addRecords("posts", records);
  // A card with posts on the calendar is scheduled, if it wasn't further along.
  if (p.cardId) advanceCard(p.cardId, "scheduled");
  return ids;
}

/**
 * One trial reel per version of a hook (a Studio edit's versions, exported):
 * a test of what's on screen, each version posted as a trial reel from one
 * Instagram account, a few minutes apart, each with its own video file.
 */
export function lineUpTrialReels(o: {
  cardId?: string;
  editId?: string;
  name: string;
  metric: TestMetric;
  versions: { label: string; text: string; video?: PostVideo }[];
  accountId?: string;
  start: number;
  gapMin: number;
  caption: string;
}) {
  const hub = useHub.getState();
  const variants: Test["variants"] = o.versions.map((v) => ({ id: uid(), label: v.label, value: v.text, editId: o.editId }));
  const testId = hub.addRecord("tests", { cardId: o.cardId, name: o.name, variable: "overlay", metric: o.metric, variants, learned: "", status: "running" });
  const withPosts = variants.map((v, i) => {
    const [postId] = planPosts({
      cardId: o.cardId,
      targets: [{ platform: "instagram", accountId: o.accountId }],
      start: o.start + i * o.gapMin * 60_000,
      gapMin: 0,
      jitterMin: 0,
      captions: [o.caption],
      trial: true,
      testId,
      variantId: v.id,
      video: o.versions[i].video,
    });
    return { ...v, postId };
  });
  hub.updateRecord("tests", testId, { variants: withPosts });
  return { testId, postIds: withPosts.map((v) => v.postId) };
}

/** Moves a card forward to `stage`, never back. */
export function advanceCard(cardId: string, stage: ContentItem["stage"]) {
  const s = useHub.getState();
  const card = s.items.find((i) => i.id === cardId);
  if (card && stageIndex(card.stage) < stageIndex(stage)) s.updateItem(cardId, { stage });
}

export function markPosted(postId: string, url?: string) {
  const s = useHub.getState();
  const post = s.posts.find((p) => p.id === postId);
  if (!post) return;
  s.updateRecord("posts", postId, { status: "posted", ...(url !== undefined ? { url } : {}) });
  if (post.cardId) advanceCard(post.cardId, "posted");
  const sound = post.soundId && s.sounds.find((x) => x.id === post.soundId);
  if (sound && sound.status !== "used") s.updateRecord("sounds", sound.id, { status: "used" });
}

/** Saves a post's numbers; the card moves to Analysed once any of its posts has them. */
export function logResults(postId: string, results: Omit<PostResults, "at">) {
  const s = useHub.getState();
  const post = s.posts.find((p) => p.id === postId);
  if (!post) return;
  const clean = Object.fromEntries(Object.entries(results).filter(([, v]) => typeof v === "number" && Number.isFinite(v)));
  s.updateRecord("posts", postId, { results: { ...clean, at: Date.now() }, status: "posted" });
  if (post.cardId) advanceCard(post.cardId, "analysed");
}

/** Posted at least a day ago with no numbers yet: what the results nudge lists. */
export const needsResults = (p: Post, now = Date.now()) => p.status === "posted" && !p.results && now - p.at > DAY;

export const isDue = (p: Post, now = Date.now()) => p.status === "planned" && p.at <= now + 30 * 60_000;

/** Short name for what's posting: the card's title, else the caption's first words. */
export function postTitle(p: Post, items: ContentItem[]) {
  const card = p.cardId ? items.find((i) => i.id === p.cardId) : undefined;
  return card?.title || p.caption.split("\n")[0].slice(0, 60) || "Untitled post";
}

/** "Mon 3", for column heads. */
export const shortDay = (key: string) => dayDate(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

export const isToday = (key: string) => key === dayKey();

// ------------------------------------------------------------------ for Claude

/** Goals and how this week is going, what's coming up, and the last review's plan, in a few lines. */
export function planSummary(now = Date.now()) {
  const s = useHub.getState();
  const lines: string[] = [];
  const start = weekStart(now);
  const pillar = (p: Pillar) => p[0].toUpperCase() + p.slice(1);
  if (s.goals.length) {
    lines.push(
      "Weekly posting goals (this week so far): " +
        s.goals
          .map((g) => {
            const pr = goalProgress(g, s.posts, s.items, start);
            return `${goalLabel(g, pillar)} ${pr.done}/${g.perWeek} posted${pr.planned ? `, ${pr.planned} more scheduled` : ""}`;
          })
          .join("; ") +
        ".",
    );
  }
  const soon = s.posts.filter((p) => p.status === "planned" && p.at >= now && p.at < now + 7 * DAY).sort((a, b) => a.at - b.at);
  if (soon.length) {
    const videos = [...new Set(soon.map((p) => postTitle(p, s.items)))];
    lines.push(`Scheduled in the next 7 days: ${soon.length} posts of ${videos.length} videos (${videos.slice(0, 6).join("; ")}).`);
  }
  const day = s.days.filter((d) => d.date >= dayKey(new Date(now))).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (day) {
    const titles = day.cardIds.map((id) => s.items.find((i) => i.id === id)?.title).filter(Boolean);
    lines.push(`Next recording day: ${day.date}${day.time ? ` at ${day.time}` : ""}, ${titles.length} videos (${titles.slice(0, 8).join("; ")}).`);
  }
  const review = [...s.reviews].sort((a, b) => b.week.localeCompare(a.week))[0];
  if (review && (review.next.trim() || review.learned.trim())) {
    lines.push(
      `Their last weekly review (week of ${review.week}):` +
        (review.learned.trim() ? ` learned: ${review.learned.trim().slice(0, 400)}.` : "") +
        (review.next.trim() ? ` Focus next: ${review.next.trim().slice(0, 400)}.` : ""),
    );
  }
  return lines.join("\n");
}
