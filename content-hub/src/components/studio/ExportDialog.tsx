"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, FolderInput, HardDrive, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { addVideos } from "@/lib/footage/library";
import type { Footage } from "@/lib/footage/types";
import { exportEdit, exportFormat, exportName, type ExportResult } from "@/lib/studio/export";
import { setPlaying } from "@/lib/studio/player";
import { ASPECTS, editLength, hookVersions, withHook, type Aspect, type Edit } from "@/lib/studio/types";
import { Modal } from "../Modal";
import { TrialReels, type MadeVersion } from "./TrialReels";

interface Made extends ExportResult {
  aspect: Aspect;
  /** Which version of the hook, when exporting a test. */
  label?: string;
  text?: string;
  /** Object URL of the blob; empty when the file went straight to disk. */
  url: string;
  saved?: boolean;
}

type SavePicker = (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>;

const EXPORTS_FOLDER = "Exports";
// Past this, the file is written straight to disk where the browser allows it,
// so a long YouTube edit never has to fit in the tab's memory.
const LONG = 180;

function save(made: Made) {
  if (!made.url) return;
  const a = document.createElement("a");
  a.href = made.url;
  a.download = made.filename;
  a.click();
}

export function ExportDialog({ edit, footage, onClose }: { edit: Edit; footage: Record<string, Footage>; onClose: () => void }) {
  const [shapes, setShapes] = useState<Set<Aspect>>(new Set([edit.aspect]));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    aspect: Aspect;
    label?: string;
    n: number;
    of: number;
    done: number;
    note: string;
  } | null>(null);
  const [made, setMade] = useState<Made[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formats, setFormats] = useState<Partial<Record<Aspect, string>>>({});
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  const length = editLength(edit);
  const picker = typeof window !== "undefined" ? (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker : undefined;
  const toDisk = length > LONG && !!picker;
  // Hook versions to test: one video each. A long edit written to disk goes one file at a time, so it exports the one on screen.
  const lines = hookVersions(edit);
  const canTest = lines.length >= 2 && !toDisk;
  const [every, setEvery] = useState(canTest);
  const testing = canTest && every;

  useEffect(() => {
    setPlaying(false);
    const list = urls.current;
    // The file type is needed for the save box's name, before the click's
    // permission to open it runs out.
    for (const a of ASPECTS) void exportFormat(a.id).then((ext) => setFormats((f) => ({ ...f, [a.id]: ext })));
    return () => {
      abort.current?.abort();
      for (const u of list) URL.revokeObjectURL(u);
    };
  }, []);

  const start = async () => {
    setError(null);
    const chosen = ASPECTS.filter((x) => shapes.has(x.id));
    // To disk: one shape per click, and the save box opens first, while the click still counts.
    let writable: FileSystemWritableFileStream | undefined;
    let handle: FileSystemFileHandle | undefined;
    if (toDisk) {
      const a = chosen[0];
      const ext = formats[a.id] ?? "mp4";
      try {
        handle = await picker!({
          suggestedName: exportName(edit, a.id, ext),
          types: [
            {
              description: ext === "mp4" ? "MP4 video" : "WebM video",
              accept: {
                [ext === "mp4" ? "video/mp4" : "video/webm"]: [`.${ext}`],
              },
            },
          ],
        });
        writable = await handle.createWritable();
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
        return;
      }
    }
    setRunning(true);
    const ac = new AbortController();
    abort.current = ac;
    // Every version in every shape picked; versions are named "<title> B 9x16".
    const runs = (testing ? lines : [null]).flatMap((v) => (toDisk ? chosen.slice(0, 1) : chosen).map((a) => ({ v, a })));
    if (testing) setMade([]);
    try {
      for (const [n, { v, a }] of runs.entries()) {
        const step = {
          aspect: a.id,
          label: v?.label,
          n: n + 1,
          of: runs.length,
        };
        setProgress({ ...step, done: 0, note: "Getting ready" });
        const src = v ? { ...withHook(edit, v.text), title: `${edit.title} ${v.label}` } : edit;
        const result = await exportEdit(src, footage, {
          aspect: a.id,
          signal: ac.signal,
          writable,
          onProgress: (p) => setProgress({ ...step, ...p }),
        });
        const url = result.blob ? URL.createObjectURL(result.blob) : "";
        if (url) urls.current.push(url);
        const size = handle ? (await handle.getFile().catch(() => null))?.size ?? 0 : result.size;
        const m: Made = {
          ...result,
          size,
          filename: handle?.name ?? result.filename,
          aspect: a.id,
          url,
          label: v?.label,
          text: v?.text,
        };
        setMade((list) => [...list, m]);
        // A test's versions go to Footage below, not into a pile of downloads.
        if (!testing) save(m);
      }
    } catch (e) {
      // A half-written file is closed (not kept open), so the browser lets it go.
      await writable?.abort().catch(() => {});
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
      abort.current = null;
    }
  };

  const toLibrary = (m: Made) => {
    if (!m.blob) return;
    void addVideos([new File([m.blob], m.filename, { type: m.blob.type })], EXPORTS_FOLDER);
    setMade((list) => list.map((x) => (x === m ? { ...x, saved: true } : x)));
  };

  // One file per version for the trial reels: the vertical one where there is one.
  const forTrial = testing
    ? lines.map((l) => made.find((m) => m.label === l.label && m.blob && m.aspect === "9:16") ?? made.find((m) => m.label === l.label && m.blob))
    : [];
  const trialReady = testing && !running && forTrial.length === lines.length && forTrial.every(Boolean);

  return (
    <Modal title="Export" onClose={running ? () => {} : onClose} className="max-w-md">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {canTest && (
          <div data-export-versions>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">Banner</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  on: true,
                  title: `All ${lines.length} versions`,
                  hint: "One video each, for trial reels",
                },
                {
                  on: false,
                  title: "Just the one on screen",
                  hint: edit.overlay.text.trim() || "No banner",
                },
              ].map((o) => (
                <button
                  key={String(o.on)}
                  disabled={running}
                  onClick={() => setEvery(o.on)}
                  className={cx(
                    "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
                    every === o.on ? "border-line-strong bg-surface-2" : "border-line hover:border-line-strong",
                  )}
                  data-export-every={o.on}
                >
                  <span className="block text-xs font-medium text-ink">{o.title}</span>
                  <span className="block truncate text-[11px] text-faint">{o.hint}</span>
                </button>
              ))}
            </div>
            {every && (
              <ul className="mt-2 space-y-0.5">
                {lines.map((l) => (
                  <li key={l.label} className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="grid size-4 shrink-0 place-items-center rounded bg-surface-3 text-[10px] font-semibold">{l.label}</span>
                    <span className="truncate">{l.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">{toDisk ? "Shape" : "Shapes"}</div>
          <div className="grid grid-cols-2 gap-2">
            {ASPECTS.map((a) => {
              const on = shapes.has(a.id);
              return (
                <button
                  key={a.id}
                  disabled={running}
                  onClick={() =>
                    setShapes((s) => {
                      if (toDisk) return new Set([a.id]);
                      const next = new Set(s);
                      if (on && next.size > 1) next.delete(a.id);
                      else next.add(a.id);
                      return next;
                    })
                  }
                  className={cx(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
                    on ? "border-line-strong bg-surface-2" : "border-line hover:border-line-strong",
                  )}
                >
                  <span className={cx("grid size-4 place-items-center rounded border", on ? "border-ink bg-ink text-bg" : "border-line-strong")}>
                    {on && <Check className="size-3" />}
                  </span>
                  <span>
                    <span className="block text-xs font-medium text-ink">{a.label}</span>
                    <span className="block text-[11px] text-faint">
                      {a.hint} · {a.w}×{a.h}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ghost">
            Every shape uses the same cuts, captions and text; framing follows each clip&apos;s subject.
          </p>
        </div>

        {progress && (
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>
                {progress.of > 1 ? `${progress.n} of ${progress.of} · ` : ""}
                {progress.label ? `${progress.label} · ` : ""}
                {progress.aspect} · {progress.note}
              </span>
              <span className="tabular-nums">{Math.round(progress.done * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full bg-ink transition-[width]" style={{ width: `${progress.done * 100}%` }} data-studio-progress />
            </div>
            <p className="mt-2 text-[11px] text-ghost">The video is made in this browser. Keep this tab open until it finishes.</p>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 text-xs text-critical-text">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {made.length > 0 && (
          <ul className="space-y-1.5" data-studio-made>
            {made.map((m, i) => (
              <li key={m.url || `${m.filename}:${i}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                {m.label ? (
                  <span className="grid size-4 shrink-0 place-items-center rounded bg-surface-3 text-[10px] font-semibold text-muted">{m.label}</span>
                ) : (
                  <Check className="size-3.5 text-good-text" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{m.filename}</span>
                <span className="text-[11px] tabular-nums text-faint">{(m.size / 1024 / 1024).toFixed(1)} MB</span>
                {m.blob ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => save(m)} title={m.label ? "Download" : "Download again"}>
                      <Download className="size-3.5" />
                    </Button>
                    {!testing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={m.saved}
                        onClick={() => toLibrary(m)}
                        title={`Save to Footage › ${EXPORTS_FOLDER}, where the team can find it`}
                      >
                        <FolderInput className="size-3.5" /> {m.saved ? "Saved" : "Footage"}
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-faint">
                    <HardDrive className="size-3" /> On your computer
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {trialReady && <TrialReels edit={edit} made={forTrial as MadeVersion[]} />}

        {length > LONG && !running && !made.length && (
          <p className="text-[11px] leading-relaxed text-warning">
            This edit runs {Math.round(length / 60)} minutes.{" "}
            {toDisk
              ? "You'll pick where to save it first; the video is written there as it's made, so it never has to fit in the tab's memory. One shape at a time."
              : "Long exports take a while and use a lot of memory. Chrome or Edge on a computer can write it straight to disk instead."}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
        {running ? (
          <Button variant="ghost" onClick={() => abort.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            {made.length ? "Done" : "Cancel"}
          </Button>
        )}
        <Button variant="primary" onClick={start} disabled={running} data-studio-export>
          {running ? <LoaderCircle className="size-3.5 animate-spin" /> : toDisk ? <HardDrive className="size-3.5" /> : <Download className="size-3.5" />}
          {toDisk
            ? "Save as…"
            : made.length
              ? "Export again"
              : testing
                ? `Export ${lines.length * shapes.size} videos`
                : shapes.size > 1
                  ? `Export ${shapes.size} videos`
                  : "Export"}
        </Button>
      </div>
    </Modal>
  );
}
