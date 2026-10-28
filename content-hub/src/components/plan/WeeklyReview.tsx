"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Sparkles, Square } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Button, Card, Delta, cx, inputCls } from "@/components/ui";
import { streamClaude } from "@/lib/claude";
import { compact, factsFor, median } from "@/lib/insights";
import { pillarLabel } from "@/lib/meta";
import { METRICS, weeklySeries } from "@/lib/metrics";
import { goalLabel, goalProgress, platformLabel, postTitle, weekKey, weekLabel } from "@/lib/plan";
import { useHub } from "@/lib/store";
import type { Review } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { PlatformDot } from "./bits";
import { GoalsStrip } from "./Goals";

const DAY = 86_400_000;

const QUESTIONS: { key: "worked" | "didnt" | "learned" | "next"; label: string; hint: string }[] = [
  { key: "worked", label: "What worked?", hint: "The post, hook or habit that went well, and why you think it did" },
  { key: "didnt", label: "What didn't?", hint: "What flopped, what slipped, what got in the way" },
  { key: "learned", label: "What did you learn?", hint: "About your audience, your process, yourself" },
  { key: "next", label: "Focus for next week", hint: "One or two things. Claude reads this when it plans and writes with you" },
];

/** Monday of the week to review: last week early in the week, this week from Thursday on. */
function defaultWeek() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  return weekKey(now.getTime() - (dow < 3 ? 7 * DAY : 0));
}

const weekStartMs = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** The weekly review ritual: the week's numbers, four questions, and Claude's read. */
export function WeeklyReview() {
  const reviews = useHub((s) => s.reviews);
  const items = useHub((s) => s.items);
  const posts = useHub((s) => s.posts);
  const edits = useHub((s) => s.edits);
  const accounts = useHub((s) => s.accounts);
  const goals = useHub((s) => s.goals);
  const tests = useHub((s) => s.tests);
  const activity = useHub((s) => s.activityDays);
  const [week, setWeek] = useState(defaultWeek);
  const [writing, setWriting] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const now = useNow();
  const review = reviews.find((r) => r.week === week);
  const start = weekStartMs(week);
  const end = start + 7 * DAY;

  const stats = useMemo(() => {
    const inWeek = posts.filter((p) => p.at >= start && p.at < end && p.status === "posted");
    const videos = new Set(inWeek.map((p) => p.cardId ?? p.id)).size;
    const facts = factsFor(inWeek, items, edits, accounts).filter((f) => f.post.results?.views != null);
    const views = facts.reduce((n, f) => n + (f.post.results!.views ?? 0), 0);
    const best = [...facts].sort((a, b) => b.post.results!.views! - a.post.results!.views!).slice(0, 3);
    const moves = METRICS.map((m) => {
      const series = weeklySeries(items, m.id, 12, end - 1);
      return { label: m.label, now: series[series.length - 1].count, before: series[series.length - 2].count };
    });
    const days = activity.filter((d) => d >= week && weekStartMs(d) < end).length;
    return { inWeek, videos, facts, views, best, moves, days, medianViews: median(facts.map((f) => f.post.results!.views!)) };
  }, [posts, items, edits, accounts, activity, start, end, week]);

  const save = (patch: Partial<Review>) => {
    const hub = useHub.getState();
    const cur = hub.reviews.find((r) => r.week === week);
    if (cur) hub.updateRecord("reviews", cur.id, patch);
    else hub.addRecord("reviews", { week, worked: "", didnt: "", learned: "", next: "", summary: "", ...patch });
  };

  const draft = async () => {
    const ac = new AbortController();
    abort.current = ac;
    setWriting(true);
    const goalLines = goals.map((g) => {
      const p = goalProgress(g, posts, items, start);
      return `- ${goalLabel(g, pillarLabel)}: ${p.done} of ${g.perWeek} posted`;
    });
    const postLines = stats.inWeek.map((p) => {
      const r = p.results;
      return `- ${postTitle(p, items)} (${p.platform}${p.trial ? ", trial reel" : ""}): ${r ? `${compact(r.views ?? 0)} views${r.avgWatch != null ? `, ${Math.round(r.avgWatch)}% watched` : ""}${r.shares != null ? `, ${r.shares} shares` : ""}${r.saves != null ? `, ${r.saves} saves` : ""}${r.follows != null ? `, ${r.follows} follows` : ""}` : "no results logged"}`;
    });
    const testLines = tests.filter((t) => t.updatedAt >= start).map((t) => `- ${t.name} (${t.status})${t.learned ? `: ${t.learned}` : ""}`);
    const prompt = [
      `Write my weekly review for the week of ${weekLabel(week)}. Keep it short and honest, in plain words, as three headed sections: **Double down** (what to keep doing, with the evidence), **Drop** (what to stop), **Test next** (one or two specific tests for next week, e.g. a hook type or overlay to try as trial reels). Then one line: the focus I should set for next week. Don't pad; if there's too little data to say something, say so.`,
      `Goals:\n${goalLines.join("\n") || "- none set"}`,
      `Pipeline this week vs last: ${stats.moves.map((m) => `${m.label} ${m.now} (was ${m.before})`).join(", ")}. Active ${stats.days} of 7 days.`,
      `Posted this week (${stats.inWeek.length} posts, ${stats.videos} videos):\n${postLines.join("\n") || "- nothing posted"}`,
      testLines.length ? `Tests:\n${testLines.join("\n")}` : "",
      review && (review.worked || review.didnt || review.learned)
        ? `What I said:\nWorked: ${review.worked || "-"}\nDidn't: ${review.didnt || "-"}\nLearned: ${review.learned || "-"}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await streamClaude([{ role: "user", content: prompt }], "Calendar screen, weekly review", (text) => save({ summary: text }), ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") save({ summary: `⚠️ ${(e as Error).message}` });
    } finally {
      setWriting(false);
      abort.current = null;
    }
  };

  const shift = (n: number) => setWeek((w) => weekKey(weekStartMs(w) + n * 7 * DAY + 12 * 3_600_000));
  const past = [...reviews].sort((a, b) => b.week.localeCompare(a.week));

  return (
    <div className="space-y-5" data-review>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Week before">
          <ChevronLeft className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Week after" disabled={weekStartMs(week) + 7 * DAY > now}>
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="text-[15px] font-semibold text-ink">Week of {weekLabel(week)}</h2>
        {review && <span className="text-xs text-good-text">Reviewed</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Videos posted" value={String(stats.videos)} sub={`${stats.inWeek.length} posts in all`} />
        <Stat label="Views logged" value={compact(stats.views)} sub={stats.facts.length ? `median ${compact(stats.medianViews)} per post` : "log results to see them"} />
        <Stat label="Days active" value={`${stats.days}/7`} />
        <Stat label="Recorded" value={String(stats.moves[2].now)} delta={stats.moves[2].now - stats.moves[2].before} />
      </div>

      <GoalsStrip week={start} />

      {stats.best.length > 0 && (
        <Card title="Best this week">
          <ul className="divide-y divide-line border-t border-line">
            {stats.best.map((f) => (
              <li key={f.post.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <PlatformDot platform={f.post.platform} />
                <span className="min-w-0 flex-1 truncate text-ink">{postTitle(f.post, items)}</span>
                <span className="hidden text-faint sm:inline">{platformLabel(f.post.platform)}</span>
                <span className="tabular-nums text-muted">{compact(f.post.results!.views!)} views</span>
                {f.post.results!.avgWatch != null && <span className="tabular-nums text-faint">{Math.round(f.post.results!.avgWatch)}% watched</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {QUESTIONS.map((q) => (
            <label key={q.key} className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{q.label}</span>
              <textarea
                value={review?.[q.key] ?? ""}
                onChange={(e) => save({ [q.key]: e.target.value })}
                rows={3}
                placeholder={q.hint}
                className={cx(inputCls, "resize-y")}
                data-review-field={q.key}
              />
            </label>
          ))}
        </div>
        <Card
          title="Claude's read"
          description="Double down, drop, test next: from the week's numbers and your answers."
          action={
            writing ? (
              <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
                <Square className="size-3" /> Stop
              </Button>
            ) : (
              <Button size="sm" variant="ai" onClick={() => void draft()} data-review-draft>
                <Sparkles className="size-3.5" /> {review?.summary ? "Write it again" : "Draft my review"}
              </Button>
            )
          }
        >
          <div className="px-4 pb-4 pt-2 text-[13px]" data-review-summary>
            {review?.summary ? (
              <Markdown text={review.summary} />
            ) : writing ? (
              <p className="flex items-center gap-2 text-xs text-faint">
                <LoaderCircle className="size-3.5 animate-spin" /> Reading the week…
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-faint">Answer what you can, then let Claude read the week with you.</p>
            )}
          </div>
        </Card>
      </div>

      {past.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">Past reviews</div>
          <div className="flex flex-wrap gap-1.5">
            {past.map((r) => (
              <button
                key={r.id}
                onClick={() => setWeek(r.week)}
                className={cx("h-7 rounded-md border px-2.5 text-xs", r.week === week ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-ink")}
              >
                {weekLabel(r.week)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold tracking-tight text-ink">{value}</span>
        {delta != null && <Delta value={delta} />}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-ghost">{sub}</div>}
    </div>
  );
}
