"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Clapperboard, MonitorPlay, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Ctl, Teleprompter } from "@/components/Teleprompter";
import { Badge, Button, Card, ConfirmAction, Empty, PillarTag, cx, inputCls, selectCls } from "@/components/ui";
import { stageIndex, stageLabel } from "@/lib/meta";
import { advanceCard, dayDate } from "@/lib/plan";
import { dayKey, useHub } from "@/lib/store";
import type { ContentItem, RecordingDay } from "@/lib/types";
import { FieldLabel } from "./bits";

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const spoken = (i: ContentItem) => Math.round((words(i.script) / 150) * 60);
const prettyDay = (key: string) => dayDate(key).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/** Batch mode: plan a recording day, line up the scripts, record them back to back. */
export function RecordingDays({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const days = useHub((s) => s.days);
  const today = dayKey();
  const upcoming = [...days].filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = [...days].filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const open = days.find((d) => d.id === openId) ?? null;

  const create = () => {
    // The next Saturday by default: most people batch on a free day.
    const d = new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    const id = useHub.getState().addRecord("days", { date: dayKey(d), time: "10:00", title: "Recording day", cardIds: [], recorded: [], notes: "" });
    onOpen(id);
  };

  if (open) return <DayEditor day={open} onBack={() => onOpen(null)} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          Batch it: line up 5 to 10 scripts, sit down once, and record them back to back on the teleprompter. Each one you tick moves to Recorded.
        </p>
        <Button variant="primary" onClick={create} data-day-new>
          <Plus className="size-3.5" /> Plan a recording day
        </Button>
      </div>
      {upcoming.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((d) => (
            <DayCard key={d.id} day={d} onOpen={() => onOpen(d.id)} />
          ))}
        </div>
      ) : (
        <Empty>
          <Clapperboard className="mx-auto mb-2 size-5 text-ghost" />
          No recording day planned. One a week is enough to post every day.
        </Empty>
      )}
      {past.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">Done</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.slice(0, 6).map((d) => (
              <DayCard key={d.id} day={d} onOpen={() => onOpen(d.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DayCard({ day, onOpen }: { day: RecordingDay; onOpen: () => void }) {
  const items = useHub((s) => s.items);
  const cards = day.cardIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ContentItem[];
  const mins = Math.round(cards.reduce((n, c) => n + spoken(c), 0) / 60);
  return (
    <button onClick={onOpen} className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong" data-day-card>
      <div className="text-[11px] text-faint">
        {prettyDay(day.date)}
        {day.time ? ` · ${day.time}` : ""}
      </div>
      <div className="mt-1 text-[13px] font-medium text-ink">{day.title || "Recording day"}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge>
          {cards.length} script{cards.length === 1 ? "" : "s"}
        </Badge>
        {mins > 0 && <span>about {mins} min on camera</span>}
        {day.recorded.length > 0 && (
          <span className="text-good-text">
            {day.recorded.length}/{cards.length} recorded
          </span>
        )}
      </div>
    </button>
  );
}

function DayEditor({ day, onBack }: { day: RecordingDay; onBack: () => void }) {
  const items = useHub((s) => s.items);
  const allDays = useHub((s) => s.days);
  const askClaude = useHub((s) => s.askClaude);
  const openItem = useHub((s) => s.openItem);
  const [prompting, setPrompting] = useState<number | null>(null);
  const set = (patch: Partial<RecordingDay>) => useHub.getState().updateRecord("days", day.id, patch);
  const cards = day.cardIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ContentItem[];
  const total = cards.reduce((n, c) => n + spoken(c), 0);

  // Scripts that could go on: not recorded yet, not already lined up for another day.
  const elsewhere = useMemo(() => new Set(allDays.filter((d) => d.id !== day.id && d.date >= dayKey()).flatMap((d) => d.cardIds)), [allDays, day.id]);
  const candidates = items
    .filter((i) => stageIndex(i.stage) < stageIndex("recorded") && i.stage !== "idea" && !day.cardIds.includes(i.id) && !elsewhere.has(i.id))
    .sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage) || words(b.script) - words(a.script));
  const ready = candidates.filter((i) => i.stage === "ready" || (i.stage === "scripting" && words(i.script) > 20));

  const move = (i: number, by: number) => {
    const list = [...day.cardIds];
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ cardIds: list });
  };

  return (
    <div className="space-y-5" data-day-editor>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="size-3.5" /> Recording days
        </Button>
        <div className="flex-1" />
        <ConfirmAction
          question="Delete this recording day?"
          onConfirm={() => {
            useHub.getState().deleteRecord("days", day.id);
            onBack();
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-faint hover:text-critical-text"
        >
          <Trash2 className="size-3.5" /> Delete
        </ConfirmAction>
        <Button variant="primary" onClick={() => setPrompting(0)} disabled={!cards.length} data-day-start>
          <MonitorPlay className="size-3.5" /> Start recording
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="block">
              <FieldLabel>Name</FieldLabel>
              <input value={day.title} onChange={(e) => set({ title: e.target.value })} className={cx(inputCls, "h-8 py-0")} />
            </label>
            <label className="block">
              <FieldLabel>Day</FieldLabel>
              <input type="date" value={day.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className={selectCls} />
            </label>
            <label className="block">
              <FieldLabel>Time</FieldLabel>
              <input type="time" value={day.time} onChange={(e) => set({ time: e.target.value })} className={selectCls} />
            </label>
          </div>

          <Card
            title={`The lineup · ${cards.length}`}
            description={total ? `About ${Math.max(1, Math.round(total / 60))} minutes of talking, so plan for two or three times that with retakes.` : "Add the scripts to record, in order."}
          >
            {cards.length ? (
              <ol className="divide-y divide-line border-t border-line" data-day-lineup>
                {cards.map((c, i) => {
                  const done = day.recorded.includes(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-2 px-4 py-2">
                      <span className="w-5 text-xs tabular-nums text-faint">{i + 1}</span>
                      <button onClick={() => openItem(c.id)} className={cx("min-w-0 flex-1 truncate text-left text-[13px]", done ? "text-faint line-through" : "text-ink hover:underline")}>
                        {c.title}
                      </button>
                      <PillarTag pillar={c.pillar} className="hidden sm:inline-flex" />
                      <span className={cx("w-24 text-right text-[11px]", words(c.script) ? "text-faint" : "text-warning")}>
                        {words(c.script) ? `~${spoken(c)}s` : "No script yet"}
                      </span>
                      <span className="flex">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-faint hover:text-ink disabled:opacity-30" aria-label="Earlier">
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button onClick={() => move(i, 1)} disabled={i === cards.length - 1} className="rounded p-1 text-faint hover:text-ink disabled:opacity-30" aria-label="Later">
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button
                          onClick={() => set({ cardIds: day.cardIds.filter((x) => x !== c.id), recorded: day.recorded.filter((x) => x !== c.id) })}
                          className="rounded p-1 text-faint hover:text-critical-text"
                          aria-label="Take off the lineup"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="px-4 pb-4 pt-2 text-xs text-faint">Nothing lined up yet. Add scripts from the right.</p>
            )}
          </Card>

          <label className="block">
            <FieldLabel>Notes for the day</FieldLabel>
            <textarea value={day.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className={cx(inputCls, "resize-y")} placeholder="Outfits, locations, B-roll to grab, who's filming" />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ready.length > 0 && (
              <Button size="sm" onClick={() => set({ cardIds: [...day.cardIds, ...ready.slice(0, Math.max(0, 10 - day.cardIds.length)).map((i) => i.id)] })} data-day-fill>
                <Plus className="size-3.5" /> Line up the {Math.min(ready.length, Math.max(0, 10 - day.cardIds.length))} ready to record
              </Button>
            )}
            <Button
              size="sm"
              variant="ai"
              onClick={() =>
                askClaude(
                  `I'm planning a recording day on ${prettyDay(day.date)}. From my pipeline, which 5 to 8 videos should I record, and in what order (similar setups together)? Weigh my posting goals, what's already scheduled, and what has performed. For any without a finished script, say what's missing.`,
                )
              }
            >
              <Sparkles className="size-3.5" /> Ask Claude what to record
            </Button>
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Scripts to add</div>
          {candidates.length ? (
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto" data-day-candidates>
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-ink">{c.title}</span>
                    <span className="text-[10px] text-faint">
                      {stageLabel(c.stage)} · {words(c.script) ? `~${spoken(c)}s` : "no script"}
                    </span>
                  </span>
                  <button onClick={() => set({ cardIds: [...day.cardIds, c.id] })} className="rounded-md p-1 text-faint hover:bg-surface-2 hover:text-ink" aria-label={`Add ${c.title}`}>
                    <Plus className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-faint">Cards in Researching, Scripting or Ready to record show here.</p>
          )}
        </div>
      </div>

      {prompting != null && cards[prompting] && (
        <BatchPrompter
          cards={cards}
          index={prompting}
          recorded={day.recorded}
          onIndex={setPrompting}
          onRecorded={(id) => {
            if (!day.recorded.includes(id)) set({ recorded: [...day.recorded, id] });
            advanceCard(id, "recorded");
          }}
          onClose={() => setPrompting(null)}
        />
      )}
    </div>
  );
}

function BatchPrompter({
  cards,
  index,
  recorded,
  onIndex,
  onRecorded,
  onClose,
}: {
  cards: ContentItem[];
  index: number;
  recorded: string[];
  onIndex: (i: number) => void;
  onRecorded: (id: string) => void;
  onClose: () => void;
}) {
  const card = cards[index];
  const done = recorded.includes(card.id);
  const last = index === cards.length - 1;

  // Arrow keys move between scripts (up and down still set the speed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && index < cards.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, cards.length, onIndex]);

  return (
    <Teleprompter
      key={card.id}
      text={card.script || card.hooks[card.chosenHook] || ""}
      onClose={onClose}
      heading={
        <>
          <span className="tabular-nums text-white/50">
            {index + 1} of {cards.length}
          </span>
          <span className="font-medium text-white" data-prompter-title>
            {card.title}
          </span>
          {done && <span className="text-emerald-400">Recorded</span>}
        </>
      }
      actions={
        <>
          {index > 0 && (
            <Ctl onClick={() => onIndex(index - 1)}>
              <ChevronLeft className="size-4" /> Previous
            </Ctl>
          )}
          <Ctl
            active={done}
            onClick={() => {
              onRecorded(card.id);
              if (!last) onIndex(index + 1);
            }}
          >
            <Check className="size-4" /> {done ? "Recorded" : last ? "Recorded, last one" : "Recorded, next"}
          </Ctl>
          {!last && (
            <Ctl onClick={() => onIndex(index + 1)}>
              Skip <ChevronRight className="size-4" />
            </Ctl>
          )}
        </>
      }
    />
  );
}
