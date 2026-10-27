"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2, TriangleAlert, Volume2, VolumeX } from "lucide-react";
import { MomentThumb } from "@/components/library/shared";
import { Button, Segmented, cx } from "@/components/ui";
import { timecode } from "@/lib/footage/search";
import type { Footage } from "@/lib/footage/types";
import { captionsStale, restoreClip } from "@/lib/studio/ops";
import { seek, usePlayer } from "@/lib/studio/player";
import { clipStarts, keptLength, locate, type Edit, type EditClip } from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import { Label, Slider } from "./controls";
import { precise } from "./format";

const MIN_CLIP = 0.3;

export function ClipPanel({
  edit,
  footage,
  selected,
  onSelect,
  onAdd,
}: {
  edit: Edit;
  footage: Record<string, Footage>;
  selected?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const update = (fn: (clips: EditClip[]) => EditClip[]) =>
    useHub.getState().updateEdit(edit.id, (e) => ({ clips: fn(e.clips) }));
  const starts = clipStarts(edit);
  const move = (i: number, by: number) =>
    update((clips) => {
      const next = [...clips];
      const [c] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, c);
      return next;
    });

  return (
    <div className="space-y-4">
      <Button onClick={onAdd} className="w-full">
        <Plus className="size-3.5" /> Add a clip
      </Button>

      {!edit.clips.length && (
        <p className="text-xs leading-relaxed text-faint">
          Search the footage library for what was said or shown and add the moments you want, in order.
        </p>
      )}

      <ol className="space-y-1.5">
        {edit.clips.map((c, i) => {
          const item = footage[c.footageId];
          const on = c.id === selected;
          return (
            <li key={c.id}>
              <div
                className={cx(
                  "group flex cursor-pointer items-center gap-2.5 rounded-lg border p-1.5 transition-colors",
                  on ? "border-line-strong bg-surface-2" : "border-line bg-surface hover:border-line-strong",
                )}
                onClick={() => {
                  onSelect(c.id);
                  seek(starts[i] + 1e-3);
                }}
              >
                {item ? <MomentThumb item={item} at={c.in} className="h-10 w-14 rounded" /> : <div className="h-10 w-14 rounded bg-surface-3" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-ink">
                    {i + 1}. {item?.name ?? "Missing video"}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-faint">
                    {timecode(c.in)}–{timecode(c.out)} · {keptLength(c).toFixed(1)}s{c.cuts?.length ? ` · ${c.cuts.length} cut${c.cuts.length === 1 ? "" : "s"}` : ""}
                    {c.muted ? " · muted" : ""}
                  </div>
                </div>
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                  <IconBtn title="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-3.5" />
                  </IconBtn>
                  <IconBtn title="Move later" disabled={i === edit.clips.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-3.5" />
                  </IconBtn>
                  <IconBtn title="Remove clip" onClick={() => update((clips) => clips.filter((x) => x.id !== c.id))}>
                    <Trash2 className="size-3.5" />
                  </IconBtn>
                </div>
              </div>
              {on && item && (
                <ClipDetail
                  edit={edit}
                  clip={c}
                  item={item}
                  start={starts[i]}
                  onChange={(patch) => update((clips) => clips.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ClipDetail({
  edit,
  clip,
  item,
  start,
  onChange,
}: {
  edit: Edit;
  clip: EditClip;
  item: Footage;
  start: number;
  onChange: (patch: Partial<EditClip>) => void;
}) {
  const duration = item.duration ?? clip.out;
  // Re-render only when the playhead enters or leaves this clip, not every frame.
  const inside = usePlayer((s) => s.t >= start && s.t <= start + keptLength(clip));
  // The source moment under the playhead, allowing for anything cut out before it.
  const here = () => locate(edit, usePlayer.getState().t)?.source ?? clip.in;
  const cutSeconds = (clip.cuts ?? []).reduce((n, k) => n + Math.max(0, Math.min(clip.out, k.to) - Math.max(clip.in, k.from)), 0);
  const setIn = (v: number) => onChange({ in: Math.max(0, Math.min(v, clip.out - MIN_CLIP)) });
  const setOut = (v: number) => onChange({ out: Math.min(duration, Math.max(v, clip.in + MIN_CLIP)) });
  const portrait = (item.height ?? 9) > (item.width ?? 16);

  return (
    <div className="mt-1.5 space-y-4 rounded-lg border border-line bg-surface px-3 py-3">
      <section>
        <Label>Cut</Label>
        <TrimBar clip={clip} duration={duration} start={start} onChange={onChange} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" disabled={!inside} onClick={() => setIn(here())}>
            Start at playhead
          </Button>
          <Button size="sm" variant="ghost" disabled={!inside} onClick={() => setOut(here())}>
            End at playhead
          </Button>
        </div>
      </section>

      {((clip.cuts?.length ?? 0) > 0 || (clip.zooms?.length ?? 0) > 0 || captionsStale(clip)) && (
        <section className="space-y-1.5 text-xs text-muted">
          {(clip.cuts?.length ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span>
                {clip.cuts!.length} cut{clip.cuts!.length === 1 ? "" : "s"} out ({cutSeconds.toFixed(1)}s)
              </span>
              <Button size="sm" variant="ghost" onClick={() => restoreClip(edit.id, clip.id)}>
                <RotateCcw className="size-3.5" /> Restore
              </Button>
            </div>
          )}
          {(clip.zooms?.length ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span>
                {clip.zooms!.length} zoom{clip.zooms!.length === 1 ? "" : "s"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Only this clip's zooms.
                  useHub.getState().updateEdit(edit.id, (e) => ({ clips: e.clips.map((x) => (x.id === clip.id ? { ...x, zooms: [] } : x)) }));
                }}
              >
                Clear
              </Button>
            </div>
          )}
          {captionsStale(clip) && (
            <p className="flex items-start gap-1.5 text-[11px] text-warning">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" />
              Trimmed wider than its captions reach: run auto captions again.
            </p>
          )}
        </section>
      )}

      {!!item.transcript?.length && (
        <section>
          <Label>Cut on what&apos;s said</Label>
          <ul className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
            {item.transcript.map((l, i) => {
              const inside = l.end > clip.in && l.start < clip.out;
              return (
                <li key={i} className={cx("group flex items-start gap-2 rounded-md px-1.5 py-1 text-xs", inside ? "text-ink/90" : "text-ghost")}>
                  <span className="w-9 shrink-0 font-mono text-[10px] leading-5 tabular-nums text-faint">{timecode(l.start)}</span>
                  <span className="flex-1 leading-5">{l.text}</span>
                  <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="rounded px-1 text-[11px] text-faint hover:bg-surface-3 hover:text-ink" onClick={() => setIn(l.start - 0.15)}>
                      Start
                    </button>
                    <button className="rounded px-1 text-[11px] text-faint hover:bg-surface-3 hover:text-ink" onClick={() => setOut(l.end + 0.3)}>
                      End
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <Label>Framing</Label>
        <Segmented
          value={clip.fit}
          onChange={(fit) => onChange({ fit })}
          options={[
            { value: "fill", label: "Fill the frame" },
            { value: "fit", label: "Show it all" },
          ]}
        />
        <div className="mt-3 space-y-2.5">
          {/* A landscape source is cropped left-right for vertical video, a vertical one top-bottom. */}
          <Slider
            label={portrait ? "Up / down" : "Left / right"}
            value={portrait ? clip.focus.y : clip.focus.x}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => onChange({ focus: portrait ? { ...clip.focus, y: v } : { ...clip.focus, x: v } })}
          />
          <Slider label="Zoom" value={clip.zoom} min={1} max={2.5} step={0.05} onChange={(zoom) => onChange({ zoom })} />
          {clip.zoom > 1 && (
            <Slider
              label={portrait ? "Left / right" : "Up / down"}
              value={portrait ? clip.focus.x : clip.focus.y}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => onChange({ focus: portrait ? { ...clip.focus, x: v } : { ...clip.focus, y: v } })}
            />
          )}
        </div>
      </section>

      <section className="flex items-center justify-between">
        <Label className="mb-0">Sound</Label>
        <Button size="sm" variant="ghost" onClick={() => onChange({ muted: !clip.muted })}>
          {clip.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          {clip.muted ? "Muted" : "On"}
        </Button>
      </section>
    </div>
  );
}

/** The whole source with the cut window on it; drag either edge, or the window itself. */
function TrimBar({
  clip,
  duration,
  start,
  onChange,
}: {
  clip: EditClip;
  duration: number;
  start: number;
  onChange: (patch: Partial<EditClip>) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<{ edge: "in" | "out" | "both"; x0: number; in0: number; out0: number } | null>(null);
  const pct = (s: number) => `${(s / Math.max(duration, 1e-6)) * 100}%`;
  const timeAt = (clientX: number) => {
    const box = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - box.left) / box.width) * duration));
  };
  const begin = (edge: "in" | "out" | "both", e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { edge, x0: timeAt(e.clientX), in0: clip.in, out0: clip.out };
  };
  const moveTo = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const at = timeAt(e.clientX);
    if (d.edge === "in") {
      const v = Math.max(0, Math.min(at, d.out0 - MIN_CLIP));
      onChange({ in: v });
      seek(start + 1e-3); // show the new first frame
    } else if (d.edge === "out") {
      const v = Math.min(duration, Math.max(at, d.in0 + MIN_CLIP));
      onChange({ out: v });
      seek(start + (v - d.in0) - 0.04); // show the new last frame
    } else {
      const len = d.out0 - d.in0;
      const v = Math.max(0, Math.min(duration - len, d.in0 + (at - d.x0)));
      onChange({ in: v, out: v + len });
      seek(start + 1e-3);
    }
  };
  const end = () => (drag.current = null);

  return (
    <div>
      <div ref={bar} className="relative h-9 select-none rounded-md bg-surface-3" data-studio-trim>
        <div
          className="absolute inset-y-0 cursor-grab rounded-md border-2 border-white/80 bg-white/10 active:cursor-grabbing"
          style={{ left: pct(clip.in), width: pct(clip.out - clip.in) }}
          onPointerDown={(e) => begin("both", e)}
          onPointerMove={moveTo}
          onPointerUp={end}
        />
        {(["in", "out"] as const).map((edge) => (
          <div
            key={edge}
            className="absolute inset-y-[-3px] z-10 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-white shadow"
            style={{ left: pct(edge === "in" ? clip.in : clip.out) }}
            onPointerDown={(e) => begin(edge, e)}
            onPointerMove={moveTo}
            onPointerUp={end}
            data-studio-handle={edge}
            role="slider"
            aria-label={edge === "in" ? "Start of the cut" : "End of the cut"}
            aria-valuenow={edge === "in" ? clip.in : clip.out}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-faint">
        <span>{precise(clip.in)}</span>
        <span>{(clip.out - clip.in).toFixed(1)}s of {timecode(duration)}</span>
        <span>{precise(clip.out)}</span>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
