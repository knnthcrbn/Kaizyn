"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ClipboardList, Clapperboard, Copy, NotebookPen, Send } from "lucide-react";
import { GroupDialog, groupPosts, type PostGroup } from "@/components/plan/CalendarView";
import { GoalsStrip } from "@/components/plan/Goals";
import { PostDialog } from "@/components/plan/PostDialog";
import { PlatformDot } from "@/components/plan/bits";
import { VideoButton } from "@/components/plan/VideoButton";
import { Card, cx } from "@/components/ui";
import { weekStart } from "@/lib/metrics";
import { clockLabel, dayDate, markPosted, needsResults, platformLabel, weekKey } from "@/lib/plan";
import { dayKey, useHub } from "@/lib/store";
import { useNow } from "@/lib/useNow";

const DAY = 86_400_000;

/** Today's part of the plan: what's posting, this week's goals, the next recording day, and what's owed. */
export function TodayPlan() {
  const posts = useHub((s) => s.posts);
  const items = useHub((s) => s.items);
  const accounts = useHub((s) => s.accounts);
  const days = useHub((s) => s.days);
  const goals = useHub((s) => s.goals);
  const reviews = useHub((s) => s.reviews);
  const now = useNow();
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<PostGroup | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Everything planned up to the end of today, including anything left over from before.
  const endOfToday = dayDate(dayKey(new Date(now))).getTime() + DAY;
  const due = useMemo(() => groupPosts(posts.filter((p) => p.status === "planned" && p.at < endOfToday), items), [posts, items, endOfToday]);
  const postedToday = posts.filter((p) => p.status === "posted" && p.at >= endOfToday - DAY && p.at < endOfToday).length;
  const waiting = posts.filter((p) => needsResults(p, now)).length;
  const today = dayKey(new Date(now));
  const nextDay = days.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  // The review is owed from Friday on for this week, and Monday to Wednesday for last week.
  const dow = (new Date(now).getDay() + 6) % 7;
  const reviewWeek = dow >= 4 ? weekKey(now) : dow <= 2 ? weekKey(now - 7 * DAY) : null;
  const reviewOwed = reviewWeek && posts.some((p) => p.status === "posted") && !reviews.some((r) => r.week === reviewWeek);

  if (!posts.length && !goals.length && !days.length) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Send className="size-4 text-faint" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
            Set a weekly posting goal, plan a recording day, and schedule what&apos;s recorded. What&apos;s going out today will show here, with the caption to
            copy.
          </p>
          <Link href="/calendar?tab=goals" className="flex items-center gap-1 text-xs text-faint hover:text-ink">
            Set goals <ArrowRight className="size-3" />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title="Posting today"
        description={due.length ? "Copy the caption, post it, tick it off" : postedToday ? `${postedToday} posted today` : "Nothing scheduled for today"}
        action={
          <Link href="/calendar" className="flex items-center gap-1 text-xs text-faint hover:text-ink">
            Calendar <ArrowRight className="size-3" />
          </Link>
        }
      >
        {due.length ? (
          <ul className="mt-2 divide-y divide-line border-t border-line" data-today-posting>
            {due.map((g) => {
              const first = g.posts[0];
              const late = first.at < now - 30 * 60_000;
              const acc = accounts.find((a) => a.id === first.accountId);
              return (
                <li key={g.key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cx("w-16 shrink-0 text-xs tabular-nums", late ? "text-warning" : "text-faint")}>
                    {first.at < endOfToday - DAY ? "Overdue" : clockLabel(first.at)}
                  </span>
                  <PlatformDot platform={g.platform} />
                  <button onClick={() => (g.posts.length > 1 ? setOpenGroup(g) : setOpenPost(first.id))} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] text-ink">{g.title}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {g.posts.length > 1
                        ? first.testId
                          ? `${g.posts.length} trial reels to test${acc ? ` from @${acc.handle}` : ""}`
                          : `${g.posts.length} accounts on ${platformLabel(g.platform)}`
                        : acc
                          ? `@${acc.handle}`
                          : platformLabel(g.platform)}
                      {first.soundId ? " · add the sound in the app" : ""}
                    </span>
                  </button>
                  {g.posts.length === 1 && (
                    <>
                      {first.video && <VideoButton video={first.video} />}
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(first.caption);
                            setCopied(first.id);
                          } catch {}
                        }}
                        className="hidden items-center gap-1 text-xs text-faint hover:text-ink sm:inline-flex"
                      >
                        <Copy className="size-3.5" /> {copied === first.id ? "Copied" : "Caption"}
                      </button>
                      <button onClick={() => markPosted(first.id)} className="inline-flex items-center gap-1 text-xs font-medium text-ink hover:text-good-text" data-today-mark>
                        <Check className="size-3.5" /> Posted
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 pb-4 pt-2 text-xs text-faint">
            {postedToday ? "All done for today." : "Drag a recorded video onto a day in the Calendar, or schedule it from its card."}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {goals.length > 0 && (
          <Card
            title="This week"
            action={
              <Link href="/calendar?tab=goals" className="text-xs text-faint hover:text-ink">
                Goals
              </Link>
            }
          >
            <div className="px-4 pb-4 pt-2">
              <GoalsStrip week={weekStart(now)} compact />
            </div>
          </Card>
        )}
        <Link href={nextDay ? `/calendar?tab=record&day=${nextDay.id}` : "/calendar?tab=record"} className="block" data-today-recording>
          <Card>
            <div className="flex items-center gap-3 p-4">
              <Clapperboard className="size-4 text-brand" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink">{nextDay ? (nextDay.date === today ? "Recording today" : "Next recording day") : "Plan a recording day"}</div>
                <div className="text-[11px] text-faint">
                  {nextDay
                    ? `${dayDate(nextDay.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}${nextDay.time ? ` · ${nextDay.time}` : ""} · ${nextDay.cardIds.length} scripts`
                    : "Line up 5 to 10 scripts and record them back to back"}
                </div>
              </div>
              <ArrowRight className="size-3.5 text-faint" />
            </div>
          </Card>
        </Link>
        {waiting > 0 && (
          <Link href="/analytics" className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted hover:border-line-strong" data-today-results>
            <ClipboardList className="size-4 text-faint" />
            <span className="flex-1">
              {waiting} post{waiting === 1 ? "" : "s"} waiting for results
            </span>
            <ArrowRight className="size-3.5 text-faint" />
          </Link>
        )}
        {reviewOwed && (
          <Link href="/calendar?tab=review" className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-xs text-brand hover:bg-brand/10" data-today-review>
            <NotebookPen className="size-4" />
            <span className="flex-1">Weekly review: what worked, what&apos;s next</span>
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      {openPost && <PostDialog postId={openPost} onClose={() => setOpenPost(null)} />}
      {openGroup && (
        <GroupDialog
          group={openGroup}
          onClose={() => setOpenGroup(null)}
          onOpen={(id) => {
            setOpenGroup(null);
            setOpenPost(id);
          }}
        />
      )}
    </div>
  );
}
