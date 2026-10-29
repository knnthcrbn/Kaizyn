"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Download, LoaderCircle, Pause, Play, Redo2, Scissors, Sparkles, TriangleAlert, Undo2, X, ZoomIn } from "lucide-react";
import { Button, Kbd, Segmented, Tabs, cx } from "@/components/ui";
import { useLibrary } from "@/lib/footage/library";
import { buildCaptions } from "@/lib/studio/captions";
import { clearJobMessage, runJob, useJob } from "@/lib/studio/jobs";
import { addZoomAt, aiZoom, clearZooms, restorePauses } from "@/lib/studio/ops";
import { PAUSE_PRESETS, type PausePreset } from "@/lib/studio/peaks";
import { seek, setPlaying, togglePlaying, usePlayer } from "@/lib/studio/player";
import { ASPECTS, aspectSize, editLength, withDefaults, type Edit } from "@/lib/studio/types";
import { undoMark } from "@/lib/studio/undo";
import { useHub } from "@/lib/store";
import { useSync } from "@/lib/sync";
import { AudioPanel, startDeadSpace } from "./AudioPanel";
import { CaptionPanel, startAutoCaptions } from "./CaptionPanel";
import { ClipPanel } from "./ClipPanel";
import { ClipPicker } from "./ClipPicker";
import { ExportDialog } from "./ExportDialog";
import { precise } from "./format";
import { Preview } from "./Preview";
import { TextPanel } from "./TextPanel";
import { Timeline } from "./Timeline";

type Tab = "clips" | "captions" | "text" | "audio";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && (el as HTMLInputElement).type !== "range");

const FRAME = 1 / 30;

/** Play from the start again once it has reached the end. */
function playPause(total: number) {
  const { t, playing } = usePlayer.getState();
  if (!playing && t >= total - 0.05) seek(0);
  togglePlaying();
}

export function Editor({ id, onClose }: { id: string; onClose: () => void }) {
  const raw = useHub((s) => s.edits.find((e) => e.id === id));
  const edit = useMemo(() => (raw ? withDefaults(raw) : undefined), [raw]);
  const syncing = useSync((s) => s.status === "syncing" && !s.lastSync);
  const footage = useLibrary((s) => s.items);
  const [tab, setTab] = useState<Tab>("clips");
  const [selected, setSelected] = useState<string | null>(null);
  // A fresh edit opens on the clip picker.
  const [picking, setPicking] = useState(() => {
    const e = useHub.getState().edits.find((x) => x.id === id);
    return !!e && !e.clips.length;
  });
  const [exporting, setExporting] = useState(false);
  const total = edit ? editLength(edit) : 0;
  const totalRef = useRef(total);
  useEffect(() => {
    totalRef.current = total;
  });

  // ---- undo / redo: every change to this edit, with a run of quick changes (a slider drag) as one step.
  const history = useRef({ past: [] as Edit[], future: [] as Edit[], at: 0, mark: undoMark(), applying: false });
  // What the undo and redo buttons show, kept in step with the history.
  const [depth, setDepth] = useState({ past: 0, future: 0 });
  const showDepth = () => {
    const { past, future } = history.current;
    setDepth((d) => (d.past === past.length && d.future === future.length ? d : { past: past.length, future: future.length }));
  };
  useEffect(
    () =>
      useHub.subscribe((s, prev) => {
        const h = history.current;
        const now = s.edits.find((e) => e.id === id);
        const before = prev.edits.find((e) => e.id === id);
        if (!now || !before || now === before || h.applying) return;
        const t = Date.now();
        if (t - h.at > 600 || h.mark !== undoMark()) {
          h.past.push(before);
          if (h.past.length > 200) h.past.shift();
        }
        h.future = [];
        h.at = t;
        h.mark = undoMark();
        showDepth();
      }),
    [id],
  );
  const travel = (from: "past" | "future") => {
    const h = history.current;
    const target = h[from].pop();
    const cur = useHub.getState().edits.find((e) => e.id === id);
    if (!target || !cur) return;
    (from === "past" ? h.future : h.past).push(cur);
    h.applying = true;
    useHub.getState().updateEdit(id, { ...target, id });
    h.applying = false;
    h.at = 0;
    showDepth();
  };

  // Every edit opens at the start.
  useEffect(() => {
    usePlayer.setState({ t: 0, playing: false, scrubbing: false });
    // The last tool's message belongs to the edit it ran on.
    if (!useJob.getState().label) clearJobMessage();
    return () => setPlaying(false);
  }, [id]);

  // Space plays and pauses wherever the focus is, except in a text box; arrows step a frame (a second with Shift).
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === " " && !mod) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) playPause(totalRef.current);
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !mod) {
        e.preventDefault();
        setPlaying(false);
        const step = (e.shiftKey ? 1 : FRAME) * (e.key === "ArrowLeft" ? -1 : 1);
        seek(Math.min(totalRef.current, Math.max(0, usePlayer.getState().t + step)));
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        travel(e.shiftKey ? "future" : "past");
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        travel("future");
      }
    };
    // A focused button would also "click" on the space bar's release.
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " " && !typing(e.target)) e.preventDefault();
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const groups = useMemo(() => (edit ? buildCaptions(edit, footage) : []), [edit, footage]);

  if (!edit) {
    return (
      <div>
        <BackButton onClick={onClose} />
        <p className="mt-6 text-[13px] text-muted">{syncing ? "Loading the team's edits…" : "This edit isn't here. It may have been deleted."}</p>
      </div>
    );
  }

  const selectedClip = edit.clips.find((c) => c.id === selected) ?? edit.clips[0];
  const missing = edit.clips.filter((c) => !footage[c.footageId] || !footage[c.footageId]?.uploaded);
  const size = aspectSize(edit.aspect);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <BackButton onClick={onClose} />
        <input
          value={edit.title}
          onChange={(e) => useHub.getState().updateEdit(id, { title: e.target.value })}
          placeholder="Untitled edit"
          className="min-w-48 flex-1 bg-transparent text-lg font-semibold tracking-tight text-ink placeholder:text-ghost focus:outline-none"
          aria-label="Edit title"
        />
        <div className="flex items-center">
          <Button size="icon" variant="ghost" onClick={() => travel("past")} disabled={!depth.past} title="Undo (⌘Z)" aria-label="Undo">
            <Undo2 className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => travel("future")} disabled={!depth.future} title="Redo (⇧⌘Z)" aria-label="Redo">
            <Redo2 className="size-4" />
          </Button>
        </div>
        <Segmented
          value={edit.aspect}
          onChange={(aspect) => useHub.getState().updateEdit(id, { aspect })}
          options={ASPECTS.map((a) => ({ value: a.id, label: <span title={a.hint}>{a.label}</span> }))}
        />
        <Button variant="primary" onClick={() => setExporting(true)} disabled={!edit.clips.length}>
          <Download className="size-3.5" /> Export
        </Button>
      </div>

      <div className={cx("grid gap-6", edit.aspect === "16:9" ? "xl:grid-cols-[minmax(0,1fr)_400px]" : "lg:grid-cols-[minmax(0,1fr)_400px]")}>
        <div className="min-w-0 space-y-3">
          <div className="flex justify-center rounded-xl border border-line bg-black/40 p-3">
            <div style={{ width: "100%", maxWidth: `calc(58vh * ${size.w} / ${size.h})`, aspectRatio: `${size.w} / ${size.h}` }}>
              <Preview edit={edit} items={footage} groups={groups} className="block h-full w-full rounded-md" />
            </div>
          </div>
          {missing.length > 0 && (
            <p className="flex items-center gap-2 text-xs text-warning">
              <TriangleAlert className="size-3.5" />
              {missing.length === 1 ? "One clip's video" : `${missing.length} clips' videos`} isn&apos;t in the library or hasn&apos;t finished uploading.
            </p>
          )}
          <Transport total={total} disabled={!edit.clips.length} />
          <Tools edit={edit} />
          <Timeline
            edit={edit}
            footage={footage}
            selected={selectedClip?.id}
            onSelect={(clipId) => {
              setSelected(clipId);
              setTab("clips");
            }}
          />
        </div>

        <aside className="min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "clips", label: `Clips · ${edit.clips.length}` },
              { value: "captions", label: "Captions" },
              { value: "text", label: "Hook text" },
              { value: "audio", label: "Audio" },
            ]}
          />
          <div className="pt-4">
            {tab === "clips" && (
              <ClipPanel edit={edit} footage={footage} selected={selectedClip?.id} onSelect={setSelected} onAdd={() => setPicking(true)} />
            )}
            {tab === "captions" && <CaptionPanel edit={edit} footage={footage} />}
            {tab === "text" && <TextPanel edit={edit} footage={footage} />}
            {tab === "audio" && <AudioPanel edit={edit} />}
          </div>
        </aside>
      </div>

      {picking && <ClipPicker edit={edit} onClose={() => setPicking(false)} onAdded={setSelected} />}
      {exporting && <ExportDialog edit={edit} footage={footage} onClose={() => setExporting(false)} />}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <ArrowLeft className="size-3.5" /> Edits
    </Button>
  );
}

function Transport({ total, disabled }: { total: number; disabled: boolean }) {
  const t = usePlayer((s) => s.t);
  const playing = usePlayer((s) => s.playing);
  return (
    <div className="flex items-center gap-3">
      <Button size="icon" onClick={() => playPause(total)} disabled={disabled} aria-label={playing ? "Pause" : "Play"} data-studio-play>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <span className="font-mono text-xs tabular-nums text-muted" data-studio-time>
        {precise(Math.min(t, total))} <span className="text-ghost">/ {precise(total)}</span>
      </span>
      <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-ghost sm:flex">
        <Kbd>Space</Kbd> play · <Kbd>←</Kbd>
        <Kbd>→</Kbd> frame · <Kbd>⌘Z</Kbd> undo
      </span>
    </div>
  );
}

/** The one-tap tools: the AI ones in purple, the rest plain, and what the last one did. */
function Tools({ edit }: { edit: Edit }) {
  const job = useJob();
  const [deadOpen, setDeadOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const busy = !!job.label || !edit.clips.length;
  const autoCuts = edit.clips.reduce((n, c) => n + (c.cuts ?? []).filter((k) => k.auto).length, 0);
  const zooms = edit.clips.reduce((n, c) => n + (c.zooms?.length ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ai" disabled={busy} onClick={() => void startAutoCaptions(edit.id)} data-studio-autocaptions>
          <Sparkles className="size-3.5" /> Auto captions
        </Button>
        <div className="relative">
          <Button size="sm" variant="ai" disabled={busy} onClick={() => setZoomOpen((o) => !o)} data-studio-aizoom>
            <Sparkles className="size-3.5" /> AI zoom <ChevronDown className="size-3" />
          </Button>
          {zoomOpen && (
            <Menu onClose={() => setZoomOpen(false)}>
              <p className="px-2 pb-1 text-[11px] leading-relaxed text-faint">Claude reads what&apos;s said and punches in on the lines that land.</p>
              {[
                { label: "Subtle", k: 0.6 },
                { label: "Normal", k: 1 },
                { label: "Strong", k: 1.6 },
              ].map((o) => (
                <MenuItem
                  key={o.label}
                  onClick={() => {
                    setZoomOpen(false);
                    void runJob("AI zoom", async () => {
                      const n = await aiZoom(edit.id, o.k);
                      return n ? `Added ${n} zoom${n === 1 ? "" : "s"} on the lines that land.` : "Claude didn't find lines worth punching in on.";
                    });
                  }}
                >
                  {o.label}
                </MenuItem>
              ))}
              {zooms > 0 && <MenuItem onClick={() => (setZoomOpen(false), clearZooms(edit.id))}>Remove all zooms</MenuItem>}
            </Menu>
          )}
        </div>
        <div className="relative">
          <Button size="sm" disabled={busy} onClick={() => setDeadOpen((o) => !o)}>
            <Scissors className="size-3.5" /> Remove dead space <ChevronDown className="size-3" />
          </Button>
          {deadOpen && (
            <Menu onClose={() => setDeadOpen(false)}>
              {(Object.keys(PAUSE_PRESETS) as PausePreset[]).map((k) => (
                <MenuItem key={k} onClick={() => (setDeadOpen(false), void startDeadSpace(edit.id, k))}>
                  {PAUSE_PRESETS[k].label} <span className="text-faint">· pauses over {PAUSE_PRESETS[k].minGap}s</span>
                </MenuItem>
              ))}
              {autoCuts > 0 && <MenuItem onClick={() => (setDeadOpen(false), restorePauses(edit.id))}>Put the {autoCuts} pauses back</MenuItem>}
            </Menu>
          )}
        </div>
        <Button size="sm" variant="ghost" disabled={!edit.clips.length} onClick={() => addZoomAt(edit.id, usePlayer.getState().t)} title="Punch in for 1.5 seconds from the playhead">
          <ZoomIn className="size-3.5" /> Zoom here
        </Button>
      </div>
      {(job.label || job.result || job.error) && (
        <div className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", job.error ? "border-critical/40 text-critical-text" : "border-line text-muted")} data-studio-job>
          {job.label ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" />
              <span>
                {job.label}
                {job.note ? ` · ${job.note}` : ""}
              </span>
              {job.done > 0 && <span className="ml-auto font-mono tabular-nums">{Math.round(job.done * 100)}%</span>}
            </>
          ) : (
            <>
              <span className="flex-1">{job.error ?? job.result}</span>
              <button onClick={clearJobMessage} className="rounded p-0.5 hover:bg-surface-2" aria-label="Dismiss">
                <X className="size-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Menu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    const t = setTimeout(() => window.addEventListener("pointerdown", close), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", close);
    };
  }, [onClose]);
  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-line-strong bg-surface p-1 shadow-xl shadow-black/50" onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-ink hover:bg-surface-2">
      {children}
    </button>
  );
}
