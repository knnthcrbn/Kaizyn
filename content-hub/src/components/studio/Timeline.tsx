"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Music, Plus, Scissors, X } from "lucide-react";
import { MomentThumb } from "@/components/library/shared";
import { Button, cx } from "@/components/ui";
import type { Footage } from "@/lib/footage/types";
import { cutRange } from "@/lib/studio/ops";
import { loadPeaks, peaksBetween, usePeaks } from "@/lib/studio/peaks";
import { seek, setScrubbing, usePlayer } from "@/lib/studio/player";
import { clipStarts, editLength, keptLength, segLength, segments, toEditTime, type Edit } from "@/lib/studio/types";
import { precise } from "./format";

// The timeline: a ruler to scrub on, the clips (with a mark wherever something
// was cut out), the zooms, the sound's waveform (drag across it to select a
// stretch and cut it out) and the music. Zoom in to slice precisely; long
// YouTube edits scroll.

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function Timeline({
  edit,
  footage,
  selected,
  onSelect,
}: {
  edit: Edit;
  footage: Record<string, Footage>;
  selected?: string;
  onSelect: (clipId: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: 600, left: 0 });
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const total = editLength(edit);
  const segs = useMemo(() => segments(edit), [edit]);
  const starts = useMemo(() => clipStarts(edit), [edit]);
  // Pixels per second: the whole edit fits at zoom 1.
  const pps = (Math.max(view.width - 2, 100) / Math.max(total, 1)) * zoom;
  const width = Math.max(view.width, total * pps);

  // Measure the visible window, and follow it as it scrolls or resizes. A new
  // edit has no clips (and so no timeline) at first: measure once it appears.
  const shown = edit.clips.length > 0;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => setView({ width: el.clientWidth, left: el.scrollLeft });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    el.addEventListener("scroll", read, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", read);
    };
  }, [shown]);

  // Keep the playhead in view while it plays.
  useEffect(
    () =>
      usePlayer.subscribe((s) => {
        const el = scroller.current;
        if (!el || !s.playing || s.scrubbing) return;
        const x = s.t * pps;
        if (x > el.scrollLeft + el.clientWidth - 40 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.2);
      }),
    [pps],
  );

  // Measure the sound of every clip's cut (and a little either side, for trimming).
  useEffect(() => {
    for (const c of edit.clips) {
      const f = footage[c.footageId];
      if (f?.uploaded) void loadPeaks(f, Math.max(0, c.in - 2), c.out + 2);
    }
  }, [edit.clips, footage]);

  // Delete cuts the selection out; Escape lets it go.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sel || typing(e.target)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        cutRange(edit.id, sel[0], sel[1]);
        seek(sel[0]);
        setSel(null);
      } else if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, edit.id]);

  const timeAt = (clientX: number) => {
    const el = scroller.current!;
    const box = el.getBoundingClientRect();
    return Math.min(total, Math.max(0, (clientX - box.left + el.scrollLeft) / pps));
  };

  /** Dragging scrubs: the picture follows, and play/pause carries on as it was when let go. */
  const scrub = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setScrubbing(true);
    seek(timeAt(e.clientX));
    const move = (ev: PointerEvent) => seek(timeAt(ev.clientX));
    // A touch the browser takes over for scrolling ends with a cancel, not an up.
    const up = () => {
      setScrubbing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** On the waveform, a drag selects a stretch to cut; a click just moves the playhead. */
  const select = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const a = timeAt(e.clientX);
    let moved = false;
    setScrubbing(true);
    seek(a);
    const move = (ev: PointerEvent) => {
      const b = timeAt(ev.clientX);
      if (Math.abs(b - a) * pps > 4) moved = true;
      if (moved) setSel([Math.min(a, b), Math.max(a, b)]);
      seek(b);
    };
    const up = () => {
      setScrubbing(false);
      if (!moved) setSel(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  if (!shown) return null;

  // Where a clip had pieces cut from its middle.
  const joins = segs.filter((s, i) => i > 0 && segs[i - 1].clip.id === s.clip.id).map((s) => s.start);
  const zooms = edit.clips.flatMap((c) =>
    (c.zooms ?? []).flatMap((z) => {
      const a = toEditTime(segs, c.id, z.from);
      const b = toEditTime(segs, c.id, z.to);
      return a == null ? [] : [{ a, b: b ?? a + 0.5, scale: z.scale, auto: z.auto }];
    }),
  );
  const tick = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pps >= 70) ?? 600;

  return (
    <div className="space-y-1.5" data-studio-timeline-wrap>
      <div className="flex items-center gap-2 text-[11px] text-faint">
        {sel ? (
          <>
            <span className="font-mono tabular-nums text-muted">
              {precise(sel[0])}–{precise(sel[1])} ({(sel[1] - sel[0]).toFixed(1)}s)
            </span>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                cutRange(edit.id, sel[0], sel[1]);
                seek(sel[0]);
                setSel(null);
              }}
              data-studio-cut
            >
              <Scissors className="size-3.5" /> Cut out
            </Button>
            <button onClick={() => setSel(null)} className="rounded p-1 hover:bg-surface-2 hover:text-ink" aria-label="Clear selection">
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <span>Drag across the waveform to select a stretch, then cut it out (Delete).</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(1, z / 1.6))} className="rounded p-1 hover:bg-surface-2 hover:text-ink" aria-label="Zoom out">
            <Minus className="size-3.5" />
          </button>
          <input
            type="range"
            min={0}
            max={Math.log(64)}
            step={0.01}
            value={Math.log(zoom)}
            onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
            className="w-24 accent-white"
            aria-label="Timeline zoom"
          />
          <button onClick={() => setZoom((z) => Math.min(64, z * 1.6))} className="rounded p-1 hover:bg-surface-2 hover:text-ink" aria-label="Zoom in">
            <Plus className="size-3.5" />
          </button>
        </span>
      </div>

      <div ref={scroller} className="relative overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-surface-2" data-studio-timeline>
        <div className="relative" style={{ width }}>
          {/* Ruler */}
          <div className="relative h-6 cursor-ew-resize touch-pan-y border-b border-line" onPointerDown={scrub} data-studio-ruler>
            {Array.from({ length: Math.floor(total / tick) + 1 }, (_, i) => (
              <span key={i} className="absolute top-0 h-full border-l border-line pl-1 font-mono text-[10px] leading-6 text-ghost" style={{ left: i * tick * pps }}>
                {precise(i * tick).replace(/\.0$/, "")}
              </span>
            ))}
          </div>

          {/* Clips */}
          <div className="relative h-12" onPointerDown={scrub}>
            {edit.clips.map((c, i) => {
              const item = footage[c.footageId];
              const w = keptLength(c) * pps;
              if (w <= 0) return null;
              return (
                <div
                  key={c.id}
                  className={cx("absolute inset-y-0 overflow-hidden border-r-2 border-bg", c.id === selected && "ring-2 ring-inset ring-white/70")}
                  style={{ left: starts[i] * pps, width: w }}
                  onPointerDown={() => onSelect(c.id)}
                  title={item?.name}
                >
                  {item ? <MomentThumb item={item} at={c.in} className="h-full w-full opacity-70" /> : <div className="h-full bg-surface-3" />}
                  <span className="absolute bottom-0.5 left-1 truncate rounded bg-black/70 px-1 font-mono text-[10px] tabular-nums text-ink">
                    {i + 1} · {keptLength(c).toFixed(1)}s
                  </span>
                </div>
              );
            })}
            {joins.map((t) => (
              <span key={t} className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-critical-text/80" style={{ left: t * pps }} title="Cut" />
            ))}
          </div>

          {/* Zooms */}
          {zooms.length > 0 && (
            <div className="relative h-3 border-t border-line">
              {zooms.map((z, i) => (
                <span
                  key={i}
                  className={cx("absolute top-0.5 h-2 rounded-sm", z.auto ? "bg-brand/70" : "bg-white/60")}
                  style={{ left: z.a * pps, width: Math.max(3, (z.b - z.a) * pps) }}
                  title={`${z.auto ? "AI zoom" : "Zoom"} ${Math.round(z.scale * 100)}%`}
                />
              ))}
            </div>
          )}

          {/* Waveform */}
          <div className="relative h-14 cursor-text touch-pan-y border-t border-line" onPointerDown={select} data-studio-wave>
            <Waveform edit={edit} footage={footage} pps={pps} view={view} />
            {sel && (
              <div
                className="pointer-events-none absolute inset-y-0 border-x border-critical-text bg-critical/20"
                style={{ left: sel[0] * pps, width: (sel[1] - sel[0]) * pps }}
                data-studio-selection
              />
            )}
          </div>

          {/* Music */}
          {edit.music && (
            <div className="relative h-6 border-t border-line">
              <div
                className="absolute inset-y-1 flex items-center gap-1 overflow-hidden rounded bg-good/15 px-1.5 text-[10px] text-good-text"
                style={{ left: 0, width: Math.max(8, Math.min(total, edit.music.duration - edit.music.start) * pps) }}
              >
                <Music className="size-3 shrink-0" />
                <span className="truncate">{edit.music.name}</span>
              </div>
            </div>
          )}

          <Playhead pps={pps} onGrab={scrub} />
        </div>
      </div>
    </div>
  );
}

/** Only this re-renders as the playhead moves. */
function Playhead({ pps, onGrab }: { pps: number; onGrab: (e: React.PointerEvent) => void }) {
  const t = usePlayer((s) => s.t);
  return (
    <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: t * pps }}>
      <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" />
      <div
        className="pointer-events-auto absolute -top-0.5 size-3.5 -translate-x-1/2 cursor-ew-resize touch-none rounded-full bg-white shadow"
        onPointerDown={onGrab}
        data-studio-playhead
        role="slider"
        aria-label="Playhead"
        aria-valuenow={Math.round(t * 10) / 10}
        aria-valuemin={0}
      />
    </div>
  );
}

/** The sound of every piece, drawn for the stretch on screen. */
function Waveform({ edit, footage, pps, view }: { edit: Edit; footage: Record<string, Footage>; pps: number; view: { width: number; left: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const version = usePeaks((s) => s.version);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, view.width);
    const h = c.clientHeight || 56;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const t0 = view.left / pps;
    const t1 = (view.left + w) / pps;
    ctx.fillStyle = "rgba(212,212,216,0.75)";
    for (const s of segments(edit)) {
      const a = Math.max(t0, s.start);
      const b = Math.min(t1, s.start + segLength(s));
      if (b <= a) continue;
      const f = footage[s.clip.footageId];
      if (!f) continue;
      const x0 = Math.floor((a - t0) * pps);
      const n = Math.max(1, Math.ceil((b - a) * pps));
      const vals = peaksBetween(f, s.in + (a - s.start), s.in + (b - s.start), n);
      const gain = s.clip.muted ? 0 : 1;
      for (let i = 0; i < n; i++) {
        // A gentle curve, so quiet speech still shows.
        const v = Math.min(1, Math.pow(Math.min(1, (vals[i] * gain) / 0.3), 0.6));
        const bh = Math.max(1, v * (h - 6));
        ctx.fillRect(x0 + i, (h - bh) / 2, 1, bh);
      }
    }
  }, [edit, footage, pps, view, version]);
  return <canvas ref={ref} className="pointer-events-none sticky left-0 top-0 block h-full" style={{ width: view.width }} />;
}
