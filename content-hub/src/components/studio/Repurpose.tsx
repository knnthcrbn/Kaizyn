"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, LoaderCircle, Pause, Play, Scissors, Sparkles, TriangleAlert, X } from "lucide-react";
import { Badge, Button, PillarTag, cx, inputCls } from "@/components/ui";
import { fileUrl } from "@/lib/footage/api";
import { useLibrary } from "@/lib/footage/library";
import { timecode } from "@/lib/footage/search";
import type { Footage } from "@/lib/footage/types";
import { clearJobMessage, runJob, useJob } from "@/lib/studio/jobs";
import {
  SHORT_LENGTHS,
  canRepurpose,
  findShorts,
  loadSearch,
  makeShorts,
  saveSearch,
  type MakeOptions,
  type ShortIdea,
  type ShortLength,
  type ShortSearch,
} from "@/lib/studio/shorts";
import { useHub } from "@/lib/store";
import { Chips, Label, Toggle } from "./controls";

const COUNTS = [5, 10, 20];

/** One long video in, a batch of shorts out: Claude picks the moments, one tap makes them. */
export function Repurpose({ footageId, onClose, onOpenEdit }: { footageId: string; onClose: () => void; onOpenEdit: (id: string) => void }) {
  const loaded = useLibrary((s) => s.loaded);
  const item = useLibrary((s) => s.items[footageId]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="size-3.5" /> Edits
        </Button>
        <h1 className="min-w-0 truncate text-[15px] font-semibold text-ink">Shorts from {item ? `"${item.name}"` : "a long video"}</h1>
      </div>
      {!item ? (
        <p className="text-[13px] text-muted">{loaded ? "This video isn't in the footage library any more." : "Loading the library…"}</p>
      ) : !canRepurpose(item) ? (
        <p className="max-w-lg text-[13px] leading-relaxed text-muted">
          {(item.duration ?? 0) < 60
            ? "This video is under a minute: cut it in an edit instead."
            : "This video hasn't been transcribed yet. Open it in the footage library and let it finish listening, then come back."}
        </p>
      ) : (
        <Finder item={item} onOpenEdit={onOpenEdit} />
      )}
    </div>
  );
}

function Finder({ item, onOpenEdit }: { item: Footage; onOpenEdit: (id: string) => void }) {
  const [search, setSearch] = useState<ShortSearch | null>(null);
  const [ready, setReady] = useState(false);
  const [length, setLength] = useState<ShortLength>("medium");
  const [count, setCount] = useState(10);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [opts, setOpts] = useState<MakeOptions>({ cards: true, deadSpace: true, captions: true });
  const [active, setActive] = useState<string | null>(null);
  const job = useJob();
  const edits = useHub((s) => s.edits);
  const player = useRef<PlayerHandle>(null);

  // What was found last time for this video, so coming back doesn't ask Claude again.
  useEffect(() => {
    let live = true;
    clearJobMessage();
    void loadSearch(item.id).then((s) => {
      if (!live) return;
      if (s) {
        setSearch(s);
        setLength(s.length);
        setCount(s.count);
        setChosen(new Set(s.ideas.filter((x) => !x.editId).map((x) => x.key)));
      }
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [item.id]);

  const alive = (id?: string) => !!id && edits.some((e) => e.id === id);
  const ideas = search?.ideas ?? [];
  const toMake = ideas.filter((x) => chosen.has(x.key) && !alive(x.editId));

  const change = (key: string, patch: Partial<ShortIdea>) =>
    setSearch((s) => {
      if (!s) return s;
      const next = { ...s, ideas: s.ideas.map((x) => (x.key === key ? { ...x, ...patch } : x)) };
      void saveSearch(item.id, next);
      return next;
    });

  const find = () =>
    runJob("Claude is reading the transcript", async (progress) => {
      progress(0, `${item.transcript?.length ?? 0} lines, picking the moments that stand on their own`);
      const s = await findShorts(item, length, count);
      setSearch(s);
      setChosen(new Set(s.ideas.map((x) => x.key)));
      setActive(null);
      return s.ideas.length
        ? `Found ${s.ideas.length} short${s.ideas.length === 1 ? "" : "s"}. Untick any you don't want, then make them.`
        : "Claude didn't find moments that work on their own at this length. Try another length.";
    });

  const make = () => {
    const list = toMake;
    if (!list.length) return;
    void runJob(`Making ${list.length} short${list.length === 1 ? "" : "s"}`, (progress) =>
      makeShorts(item, list, opts, (key, editId) => change(key, { editId }), progress),
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="lg:sticky lg:top-4 lg:self-start">
        <RangePlayer ref={player} item={item} onStop={() => setActive(null)} />
        <p className="mt-2 text-[11px] text-ghost">
          {timecode(item.duration ?? 0)} · {item.transcript?.length ?? 0} transcript lines
        </p>
      </div>

      <div className="min-w-0 space-y-5">
        <section className="space-y-3 rounded-xl border border-line p-4">
          <div>
            <Label>Length of each short</Label>
            <Chips value={length} onChange={setLength} options={SHORT_LENGTHS.map((l) => ({ value: l.id, label: l.label }))} />
          </div>
          <div>
            <Label>How many</Label>
            <Chips value={String(count)} onChange={(v) => setCount(Number(v))} options={COUNTS.map((n) => ({ value: String(n), label: `Up to ${n}` }))} />
          </div>
          <Button variant="ai" className="w-full" onClick={() => void find()} disabled={!ready || !!job.label} data-shorts-find>
            <Sparkles className="size-3.5" /> {ideas.length ? "Find shorts again" : "Find shorts"}
          </Button>
          <p className="text-[11px] leading-relaxed text-ghost">
            Claude reads what&apos;s said and picks moments that make sense on their own: a hook up front, a payoff at the end.
            Each cut lands on the transcript&apos;s own timing.
          </p>
        </section>

        <JobLine />

        {ideas.length > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <Label className="mb-0">
                {ideas.length} short{ideas.length === 1 ? "" : "s"}
              </Label>
              <button
                onClick={() => setChosen(chosen.size ? new Set() : new Set(ideas.filter((x) => !alive(x.editId)).map((x) => x.key)))}
                className="text-[11px] text-faint hover:text-ink"
              >
                {chosen.size ? "Untick all" : "Tick all"}
              </button>
            </div>
            <ul className="space-y-2" data-shorts-list>
              {ideas.map((idea) => (
                <Idea
                  key={idea.key}
                  item={item}
                  idea={idea}
                  made={alive(idea.editId)}
                  chosen={chosen.has(idea.key)}
                  playing={active === idea.key}
                  onChoose={(on) =>
                    setChosen((s) => {
                      const next = new Set(s);
                      if (on) next.add(idea.key);
                      else next.delete(idea.key);
                      return next;
                    })
                  }
                  onPlay={() => {
                    if (active === idea.key) {
                      player.current?.stop();
                      setActive(null);
                    } else {
                      player.current?.play(idea.from, idea.to);
                      setActive(idea.key);
                    }
                  }}
                  onChange={(patch) => change(idea.key, patch)}
                  onOpen={() => idea.editId && onOpenEdit(idea.editId)}
                />
              ))}
            </ul>

            {/* Pinned to the bottom on a computer; on a phone it would cover the list, so it follows it. */}
            <div className="mt-4 space-y-3 rounded-xl border border-line bg-bg/95 p-4 backdrop-blur lg:sticky lg:bottom-0">
              <div className="grid gap-2 sm:grid-cols-3">
                <Option label="Pipeline cards" on={opts.cards} onChange={(cards) => setOpts((o) => ({ ...o, cards }))} />
                <Option label="Cut dead space" on={opts.deadSpace} onChange={(deadSpace) => setOpts((o) => ({ ...o, deadSpace }))} />
                <Option label="Auto captions" on={opts.captions} onChange={(captions) => setOpts((o) => ({ ...o, captions }))} />
              </div>
              <Button variant="primary" className="w-full" disabled={!toMake.length || !!job.label} onClick={make} data-shorts-make>
                <Scissors className="size-3.5" />
                {toMake.length ? `Make ${toMake.length} short${toMake.length === 1 ? "" : "s"}` : "Tick the shorts to make"}
              </Button>
              <p className="text-[11px] leading-relaxed text-ghost">
                Each becomes a 9:16 edit with its hook on screen{opts.cards ? " and a card in Editing" : ""}. Open any to change
                the style, zoom or music, then export.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Option({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs text-muted">
      {label}
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}

function Idea({
  item,
  idea,
  made,
  chosen,
  playing,
  onChoose,
  onPlay,
  onChange,
  onOpen,
}: {
  item: Footage;
  idea: ShortIdea;
  made: boolean;
  chosen: boolean;
  playing: boolean;
  onChoose: (on: boolean) => void;
  onPlay: () => void;
  onChange: (patch: Partial<ShortIdea>) => void;
  onOpen: () => void;
}) {
  const said = useMemo(
    () =>
      (item.transcript ?? [])
        .filter((l) => l.end > idea.from + 0.2 && l.start < idea.to - 0.2)
        .map((l) => l.text.trim())
        .join(" "),
    [item.transcript, idea.from, idea.to],
  );
  return (
    <li className={cx("rounded-xl border p-3 transition-colors", playing ? "border-line-strong bg-surface-2" : "border-line")} data-shorts-idea>
      <div className="flex items-start gap-3">
        {made ? (
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-good/15 text-good-text" title="Made">
            <Check className="size-3.5" />
          </span>
        ) : (
          <button
            role="checkbox"
            aria-checked={chosen}
            aria-label={`Make "${idea.title}"`}
            onClick={() => onChoose(!chosen)}
            className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", chosen ? "border-ink bg-ink text-bg" : "border-line-strong")}
          >
            {chosen && <Check className="size-3.5" />}
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={idea.score >= 8 ? "good" : "neutral"}>{idea.score}/10</Badge>
            <span className="font-mono text-[11px] tabular-nums text-faint">
              {timecode(idea.from)}–{timecode(idea.to)} · {Math.round(idea.to - idea.from)}s
            </span>
            <PillarTag pillar={idea.pillar} className="text-[11px]" />
          </div>
          <input
            value={idea.title}
            onChange={(e) => onChange({ title: e.target.value })}
            disabled={made}
            className="w-full bg-transparent text-[13px] font-medium text-ink focus:outline-none disabled:opacity-100"
            aria-label="Title"
          />
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ghost">Hook on screen</span>
            <input value={idea.hook} onChange={(e) => onChange({ hook: e.target.value })} disabled={made} className={cx(inputCls, "h-8 text-xs")} />
          </label>
          <p className="line-clamp-3 text-xs leading-relaxed text-muted" title={said}>
            &ldquo;{said}&rdquo;
          </p>
          <p className="text-[11px] leading-relaxed text-ghost">{idea.why}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" onClick={onPlay} data-shorts-play>
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {playing ? "Stop" : "Watch"}
            </Button>
            {made && (
              <Button size="sm" onClick={onOpen} data-shorts-open>
                Open edit <ArrowUpRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** What the batch is doing, and what it did. */
function JobLine() {
  const job = useJob();
  if (!job.label && !job.result && !job.error) return null;
  return (
    <div
      className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", job.error ? "border-critical/40 text-critical-text" : "border-line text-muted")}
      data-studio-job
    >
      {job.label ? (
        <>
          <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
          <span className="min-w-0 flex-1">
            {job.label}
            {job.note ? ` · ${job.note}` : ""}
          </span>
          {job.done > 0 && <span className="font-mono tabular-nums">{Math.round(job.done * 100)}%</span>}
        </>
      ) : (
        <>
          {job.error && <TriangleAlert className="size-3.5 shrink-0" />}
          <span className="flex-1">{job.error ?? job.result}</span>
          <button onClick={clearJobMessage} className="rounded p-0.5 hover:bg-surface-2" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

interface PlayerHandle {
  play: (from: number, to: number) => void;
  stop: () => void;
}

/** The long video, playing one suggested stretch at a time. */
function RangePlayer({ item, onStop, ref }: { item: Footage; onStop: () => void; ref: React.Ref<PlayerHandle> }) {
  const video = useRef<HTMLVideoElement>(null);
  const until = useRef<number | null>(null);
  useImperativeHandle(ref, () => ({
    play: (from, to) => {
      const v = video.current;
      if (!v) return;
      until.current = to;
      v.currentTime = from;
      void v.play().catch(() => {});
    },
    stop: () => {
      until.current = null;
      video.current?.pause();
    },
  }));
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-black">
      <video
        ref={video}
        src={fileUrl(item.file.path)}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full"
        onTimeUpdate={(e) => {
          if (until.current != null && e.currentTarget.currentTime >= until.current) {
            e.currentTarget.pause();
            until.current = null;
            onStop();
          }
        }}
        onPause={() => {
          if (until.current != null) {
            until.current = null;
            onStop();
          }
        }}
        data-shorts-player
      />
    </div>
  );
}

/** Long videos that can be cut into shorts, longest first; the rest say why not yet. */
export function LongVideoList({ onPick }: { onPick: (id: string) => void }) {
  const itemsMap = useLibrary((s) => s.items);
  const loaded = useLibrary((s) => s.loaded);
  const items = useMemo(
    () =>
      Object.values(itemsMap)
        .filter((f) => f.uploaded && (f.duration ?? 0) >= 60)
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0)),
    [itemsMap],
  );
  if (!loaded) return <p className="p-4 text-xs text-faint">Loading the library…</p>;
  if (!items.length)
    return (
      <p className="p-4 text-xs leading-relaxed text-faint">
        No videos over a minute yet. Drop a podcast, YouTube video or livestream into the{" "}
        <Link href="/library" className="text-ink underline underline-offset-2">
          footage library
        </Link>
        ; once it&apos;s transcribed, it can be cut into shorts here.
      </p>
    );
  return (
    <ul className="space-y-1">
      {items.map((f) => {
        const ok = canRepurpose(f);
        return (
          <li key={f.id}>
            <button
              onClick={() => ok && onPick(f.id)}
              disabled={!ok}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="relative block h-12 w-20 shrink-0 overflow-hidden rounded bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.poster && <img src={f.poster} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-ink">{f.name}</span>
                <span className="block text-[11px] text-faint">
                  {timecode(f.duration ?? 0)} · {ok ? `${f.transcript?.length ?? 0} lines` : "Not transcribed yet"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
