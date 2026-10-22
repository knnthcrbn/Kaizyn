import { stageIndex } from "./meta";
import { dayKey } from "./store";
import type { ContentItem, StageId, VoiceEntry, Story } from "./types";

const DAY = 86_400_000;

/** Monday 00:00 (local) of the week containing `t`. */
export function weekStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** When an item first reached `stage` or anything after it, if ever. */
function reachedAt(item: ContentItem, stage: StageId) {
  const target = stageIndex(stage);
  const hit = (item.stageHistory ?? []).find((h) => stageIndex(h.stage) >= target);
  return hit?.at;
}

export type Metric = "captured" | "scripted" | "recorded" | "posted";

export const METRICS: { id: Metric; label: string; hint: string }[] = [
  { id: "captured", label: "Ideas captured", hint: "New cards" },
  { id: "scripted", label: "Scripts finished", hint: "Reached Ready to record" },
  { id: "recorded", label: "Videos recorded", hint: "Reached Recorded" },
  { id: "posted", label: "Posts published", hint: "Reached Posted" },
];

function eventTimes(items: ContentItem[], metric: Metric) {
  return items
    // Starter cards weren't captured by the user, so they don't count.
    .filter((i) => metric !== "captured" || !i.id.startsWith("seed-"))
    .map((i) =>
      metric === "captured"
        ? i.createdAt
        : reachedAt(i, metric === "scripted" ? "ready" : metric === "recorded" ? "recorded" : "posted"),
    )
    .filter((t): t is number => typeof t === "number");
}

/** Counts per week, oldest first, ending with the current week. */
export function weeklySeries(items: ContentItem[], metric: Metric, weeks = 8, now = Date.now()) {
  const current = weekStart(now);
  const starts = Array.from({ length: weeks }, (_, i) => current - (weeks - 1 - i) * 7 * DAY);
  const counts = starts.map(() => 0);
  for (const t of eventTimes(items, metric)) {
    const ws = weekStart(t);
    const idx = starts.indexOf(ws);
    if (idx >= 0) counts[idx]++;
  }
  return starts.map((start, i) => ({ start, count: counts[i] }));
}

/** Everything the user did, counted per day: drives the activity grid. */
export function dailyActivity(items: ContentItem[], voice: VoiceEntry[], stories: Story[], activeDays: string[]) {
  const map = new Map<string, number>();
  const bump = (t: number) => {
    const k = dayKey(new Date(t));
    map.set(k, (map.get(k) ?? 0) + 1);
  };
  for (const i of items) {
    if (!i.id.startsWith("seed-")) bump(i.createdAt);
    (i.stageHistory ?? []).slice(1).forEach((h) => bump(h.at));
  }
  voice.filter((v) => v.source !== "seed").forEach((v) => bump(v.createdAt));
  stories.filter((s) => !s.id.startsWith("seed-")).forEach((s) => bump(s.createdAt));
  // Edits that don't create an event above still count as showing up.
  for (const d of activeDays) if (!map.has(d)) map.set(d, 1);
  return map;
}

export function streaks(activeDays: string[], now = new Date()) {
  const set = new Set(activeDays);
  const d = new Date(now);
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let current = 0;
  while (set.has(dayKey(d))) {
    current++;
    d.setDate(d.getDate() - 1);
  }
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of sorted) {
    const [y, m, dd] = k.split("-").map(Number);
    const t = new Date(y, m - 1, dd).getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { current, longest };
}
