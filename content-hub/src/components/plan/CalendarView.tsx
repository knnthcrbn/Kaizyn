"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Clapperboard, GripVertical, Plus, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button, Segmented, cx } from "@/components/ui";
import { PILLAR_STYLE, stageIndex, stageLabel } from "@/lib/meta";
import { weekStart } from "@/lib/metrics";
import {
  clockLabel,
  dayDate,
  dayOf,
  goalProgress,
  isToday,
  markPosted,
  moveToDay,
  platformLabel,
  postTitle,
  weekDays,
} from "@/lib/plan";
import { dayKey, useHub } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import type { ContentItem, Platform, Post, RecordingDay } from "@/lib/types";
import { PlatformDot } from "./bits";
import { GoalsStrip } from "./Goals";
import { PostDialog } from "./PostDialog";
import { ScheduleDialog } from "./ScheduleDialog";

const DAY = 86_400_000;

type Drag = { kind: "posts"; ids: string[] } | { kind: "due"; id: string } | { kind: "day"; id: string } | { kind: "card"; id: string };

/** One video on one platform on one day: 100 clipping posts show as one line. */
export interface PostGroup {
  key: string;
  title: string;
  platform: Platform;
  posts: Post[];
}

export function groupPosts(posts: Post[], items: ContentItem[]): PostGroup[] {
  const m = new Map<string, PostGroup>();
  for (const p of [...posts].sort((a, b) => a.at - b.at)) {
    const key = `${p.cardId ?? p.id}:${p.platform}:${p.testId ?? ""}`;
    const g = m.get(key) ?? { key, title: postTitle(p, items), platform: p.platform, posts: [] };
    g.posts.push(p);
    m.set(key, g);
  }
  return [...m.values()];
}

const setDrag = (e: DragEvent, d: Drag) => {
  e.dataTransfer.setData("application/x-hub", JSON.stringify(d));
  e.dataTransfer.effectAllowed = "move";
};

export function CalendarView({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  const items = useHub((s) => s.items);
  const posts = useHub((s) => s.posts);
  const days = useHub((s) => s.days);
  const goals = useHub((s) => s.goals);
  const openItem = useHub((s) => s.openItem);
  const [mode, setMode] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => Date.now());
  const [schedule, setSchedule] = useState<{ cardId?: string; day?: string } | null>(null);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<PostGroup | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const now = useNow();

  // The days on screen.
  const keys = useMemo(() => {
    if (mode === "week") return weekDays(weekStart(anchor));
    const first = new Date(anchor);
    first.setDate(1);
    const start = weekStart(first.getTime());
    return Array.from({ length: 42 }, (_, i) => dayKey(new Date(start + i * DAY + 3_600_000)));
  }, [mode, anchor]);
  const month = new Date(anchor).getMonth();

  const byDay = useMemo(() => {
    const m = new Map<string, { groups: PostGroup[]; due: ContentItem[]; rec: RecordingDay[] }>();
    for (const k of keys) m.set(k, { groups: [], due: [], rec: [] });
    const postsByDay = new Map<string, Post[]>();
    for (const p of posts) {
      const k = dayOf(p.at);
      if (m.has(k)) postsByDay.set(k, [...(postsByDay.get(k) ?? []), p]);
    }
    for (const [k, list] of postsByDay) m.get(k)!.groups = groupPosts(list, items);
    for (const i of items) if (i.dueDate && m.has(i.dueDate) && stageIndex(i.stage) < stageIndex("posted")) m.get(i.dueDate)!.due.push(i);
    for (const d of days) if (m.has(d.date)) m.get(d.date)!.rec.push(d);
    return m;
  }, [keys, posts, items, days]);

  // Cards with a video coming and nothing on the calendar yet: drag one onto a day.
  const ready = useMemo(() => {
    const planned = new Set(posts.filter((p) => p.status !== "skipped").map((p) => p.cardId));
    return items
      .filter((i) => stageIndex(i.stage) >= stageIndex("recorded") && stageIndex(i.stage) < stageIndex("posted") && !planned.has(i.id))
      .sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage));
  }, [items, posts]);

  // Heads-up when the coming week is short of the goals.
  const nudge = useMemo(() => {
    if (!goals.length) return null;
    const next = weekStart(now) + 7 * DAY;
    const want = goals.reduce((n, g) => n + g.perWeek, 0);
    const have = goals.reduce((n, g) => {
      const p = goalProgress(g, posts, items, next);
      return n + Math.min(g.perWeek, p.done + p.planned);
    }, 0);
    return have < want ? { want, have } : null;
  }, [goals, posts, items, now]);

  const drop = (key: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    let d: Drag;
    try {
      d = JSON.parse(e.dataTransfer.getData("application/x-hub"));
    } catch {
      return;
    }
    const s = useHub.getState();
    if (d.kind === "posts") for (const id of d.ids) s.updateRecord("posts", id, (p) => ({ at: moveToDay(p.at, key) }));
    else if (d.kind === "due") s.updateItem(d.id, { dueDate: key });
    else if (d.kind === "day") s.updateRecord("days", d.id, { date: key });
    else if (d.kind === "card") setSchedule({ cardId: d.id, day: key });
  };

  const step = (n: number) =>
    setAnchor((a) => {
      const d = new Date(a);
      if (mode === "week") d.setDate(d.getDate() + 7 * n);
      else d.setMonth(d.getMonth() + n, 1);
      return d.getTime();
    });

  const label =
    mode === "week"
      ? `${dayDate(keys[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${dayDate(keys[6]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
      : new Date(anchor).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const openGroupOrPost = (g: PostGroup) => (g.posts.length === 1 ? setOpenPost(g.posts[0].id) : setOpenGroup(g));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center">
          <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Earlier">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Later">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h2 className="min-w-0 text-[15px] font-semibold text-ink" data-calendar-label>
          {label}
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setAnchor(Date.now())}>
          Today
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
          <Button variant="primary" size="sm" onClick={() => setSchedule({})} data-calendar-schedule>
            <Plus className="size-3.5" /> Schedule
          </Button>
        </div>
      </div>

      <GoalsStrip week={weekStart(mode === "week" ? anchor : now)} />

      {nudge && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning" data-calendar-nudge>
          <TriangleAlert className="size-3.5 shrink-0" />
          Next week has {nudge.have} of the {nudge.want} posts your goals call for.
          {ready.length ? ` ${ready.length} recorded video${ready.length === 1 ? " is" : "s are"} ready to drag onto a day.` : " Line up a recording day."}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem]">
        <div className={cx("grid gap-px overflow-hidden rounded-xl border border-line bg-line", mode === "week" ? "md:grid-cols-7" : "grid-cols-7")} data-calendar-grid>
          {mode === "month" &&
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="bg-surface px-2 py-1.5 text-[11px] font-medium text-faint">
                {d}
              </div>
            ))}
          {keys.map((k) => {
            const cell = byDay.get(k)!;
            const outside = mode === "month" && dayDate(k).getMonth() !== month;
            const chips: ReactNode[] = [
              ...cell.rec.map((d) => (
                <Chip key={`r${d.id}`} drag={{ kind: "day", id: d.id }} onClick={() => onOpenDay(d.id)} tone="rec">
                  <Clapperboard className="size-3 shrink-0" />
                  <span className="truncate">
                    {d.title || "Recording"} · {d.cardIds.length}
                  </span>
                </Chip>
              )),
              ...cell.groups.map((g) => {
                const done = g.posts.filter((p) => p.status === "posted").length;
                const skipped = g.posts.every((p) => p.status === "skipped");
                return (
                  <Chip
                    key={g.key}
                    drag={{ kind: "posts", ids: g.posts.map((p) => p.id) }}
                    onClick={() => openGroupOrPost(g)}
                    tone={skipped ? "skipped" : done === g.posts.length ? "posted" : "planned"}
                    data-calendar-post
                  >
                    {mode === "week" ? (
                      // Week columns are narrow: time on one line, the title on the next.
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <PlatformDot platform={g.platform} />
                          <span className="tabular-nums text-faint">{clockLabel(g.posts[0].at)}</span>
                          {g.posts.length > 1 && <span className="ml-auto tabular-nums text-faint">×{g.posts.length}</span>}
                        </span>
                        <span className="line-clamp-2 leading-snug">{g.title}</span>
                      </span>
                    ) : (
                      <>
                        <PlatformDot platform={g.platform} />
                        <span className="truncate">{g.title}</span>
                        {g.posts.length > 1 && <span className="shrink-0 tabular-nums text-faint">×{g.posts.length}</span>}
                      </>
                    )}
                  </Chip>
                );
              }),
              ...cell.due.map((i) => (
                <Chip key={`d${i.id}`} drag={{ kind: "due", id: i.id }} onClick={() => openItem(i.id)} tone="due">
                  <span className={cx("size-2 shrink-0 rounded-[3px]", PILLAR_STYLE[i.pillar].dot)} />
                  <span className="truncate">{i.title}</span>
                  <span className="shrink-0 text-faint">due</span>
                </Chip>
              )),
            ];
            const limit = mode === "month" ? 3 : 50;
            return (
              <div
                key={k}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(k);
                }}
                onDragLeave={() => setOver((o) => (o === k ? null : o))}
                onDrop={drop(k)}
                className={cx(
                  "group relative flex flex-col gap-1 bg-surface p-1.5",
                  // On a phone the week is a list, so an empty day stays short.
                  mode === "week" ? "min-h-14 md:min-h-40" : "min-h-24",
                  outside && "bg-bg",
                  over === k && "bg-surface-2 ring-1 ring-inset ring-white/30",
                )}
                data-day={k}
              >
                <div className="flex items-center justify-between px-0.5">
                  <span
                    className={cx(
                      "text-[11px] tabular-nums",
                      isToday(k) ? "grid size-5 place-items-center rounded-full bg-ink font-semibold text-bg" : outside ? "text-ghost" : "text-faint",
                    )}
                  >
                    {mode === "week" ? dayDate(k).toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) : dayDate(k).getDate()}
                  </span>
                  <button
                    onClick={() => setSchedule({ day: k })}
                    className="rounded p-0.5 text-ghost opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 max-md:opacity-100"
                    aria-label={`Schedule on ${k}`}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {chips.slice(0, limit)}
                {chips.length > limit && (
                  <button onClick={() => (setMode("week"), setAnchor(dayDate(k).getTime()))} className="px-1 text-left text-[11px] text-faint hover:text-ink">
                    +{chips.length - limit} more
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <aside className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Ready to schedule</div>
          {ready.length ? (
            <ul className="space-y-1.5" data-calendar-ready>
              {ready.map((i) => (
                <li
                  key={i.id}
                  draggable
                  onDragStart={(e) => setDrag(e, { kind: "card", id: i.id })}
                  className="flex cursor-grab items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs active:cursor-grabbing"
                >
                  <GripVertical className="size-3.5 shrink-0 text-ghost" />
                  <span className={cx("size-2 shrink-0 rounded-[3px]", PILLAR_STYLE[i.pillar].dot)} />
                  <button onClick={() => setSchedule({ cardId: i.id })} className="min-w-0 flex-1 truncate text-left text-ink" title="Schedule">
                    {i.title}
                  </button>
                  <span className="shrink-0 text-[10px] text-faint">{stageLabel(i.stage)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] leading-relaxed text-ghost">Recorded videos with nothing scheduled show here. Drag one onto a day.</p>
          )}
          <p className="pt-2 text-[11px] leading-relaxed text-ghost">Drag posts, due dates and recording days to move them. Times stay the same.</p>
        </aside>
      </div>

      {schedule && <ScheduleDialog cardId={schedule.cardId} day={schedule.day} onClose={() => setSchedule(null)} />}
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

function Chip({
  children,
  drag,
  onClick,
  tone,
  ...rest
}: {
  children: ReactNode;
  drag: Drag;
  onClick: () => void;
  tone: "planned" | "posted" | "skipped" | "due" | "rec";
} & Record<`data-${string}`, unknown>) {
  return (
    <button
      draggable
      onDragStart={(e) => setDrag(e, drag)}
      onClick={onClick}
      className={cx(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] transition-colors",
        tone === "planned" && "border-line-strong bg-surface-2 text-ink hover:bg-surface-3",
        tone === "posted" && "border-good/30 bg-good/10 text-good-text hover:bg-good/15",
        tone === "skipped" && "border-line text-ghost line-through",
        tone === "due" && "border-dashed border-line-strong text-muted hover:text-ink",
        tone === "rec" && "border-brand/30 bg-brand/10 text-brand hover:bg-brand/15",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** The posts of one video on one platform that day: the posting checklist. */
export function GroupDialog({ group, onClose, onOpen }: { group: PostGroup; onClose: () => void; onOpen: (id: string) => void }) {
  const accounts = useHub((s) => s.accounts);
  const posts = useHub((s) => s.posts);
  const live = useMemo(() => {
    const ids = new Set(group.posts.map((g) => g.id));
    return posts.filter((p) => ids.has(p.id)).sort((a, b) => a.at - b.at);
  }, [posts, group]);
  const [copied, setCopied] = useState<string | null>(null);
  const done = live.filter((p) => p.status === "posted").length;
  return (
    <Modal title={`${group.title} · ${platformLabel(group.platform)}`} onClose={onClose} className="max-w-lg">
      <p className="border-b border-line px-4 py-2.5 text-xs text-faint">
        {done} of {live.length} posted. Copy each caption, post from that account, then tick it off.
      </p>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto" data-group-list>
        {live.map((p) => {
          const acc = accounts.find((a) => a.id === p.accountId);
          return (
            <li key={p.id} className="flex items-center gap-2 px-4 py-2 text-xs">
              <span className="w-16 shrink-0 tabular-nums text-faint">{clockLabel(p.at)}</span>
              <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 truncate text-left text-ink hover:underline">
                {acc ? `@${acc.handle}` : platformLabel(p.platform)}
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(p.caption);
                    setCopied(p.id);
                  } catch {}
                }}
                className="text-faint hover:text-ink"
              >
                {copied === p.id ? "Copied" : "Copy caption"}
              </button>
              {p.status === "posted" ? (
                <span className="w-16 text-right text-good-text">Posted</span>
              ) : (
                <button onClick={() => markPosted(p.id)} className="w-16 text-right font-medium text-ink hover:text-good-text" data-group-mark>
                  Mark posted
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-between gap-2 border-t border-line px-4 py-3">
        <Button size="sm" variant="ghost" onClick={() => live.filter((p) => p.status === "planned").forEach((p) => markPosted(p.id))} disabled={done === live.length}>
          Mark all posted
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
