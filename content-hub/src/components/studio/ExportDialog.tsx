"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, FolderInput, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { addVideos } from "@/lib/footage/library";
import type { Footage } from "@/lib/footage/types";
import { exportEdit, type ExportResult } from "@/lib/studio/export";
import { setPlaying } from "@/lib/studio/player";
import { ASPECTS, editLength, type Aspect, type Edit } from "@/lib/studio/types";
import { Modal } from "./Modal";

interface Made extends ExportResult {
  aspect: Aspect;
  url: string;
  saved?: boolean;
}

const EXPORTS_FOLDER = "Exports";

function save(made: Made) {
  const a = document.createElement("a");
  a.href = made.url;
  a.download = made.filename;
  a.click();
}

export function ExportDialog({ edit, footage, onClose }: { edit: Edit; footage: Record<string, Footage>; onClose: () => void }) {
  const [shapes, setShapes] = useState<Set<Aspect>>(new Set([edit.aspect]));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ aspect: Aspect; done: number; note: string } | null>(null);
  const [made, setMade] = useState<Made[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    setPlaying(false);
    const list = urls.current;
    return () => {
      abort.current?.abort();
      for (const u of list) URL.revokeObjectURL(u);
    };
  }, []);

  const start = async () => {
    setRunning(true);
    setError(null);
    const ac = new AbortController();
    abort.current = ac;
    try {
      for (const a of ASPECTS.filter((x) => shapes.has(x.id))) {
        setProgress({ aspect: a.id, done: 0, note: "Getting ready" });
        const result = await exportEdit(edit, footage, {
          aspect: a.id,
          signal: ac.signal,
          onProgress: (p) => setProgress({ aspect: a.id, ...p }),
        });
        const url = URL.createObjectURL(result.blob);
        urls.current.push(url);
        const m = { ...result, aspect: a.id, url };
        setMade((list) => [...list, m]);
        save(m);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
      abort.current = null;
    }
  };

  const toLibrary = (m: Made) => {
    void addVideos([new File([m.blob], m.filename, { type: m.blob.type })], EXPORTS_FOLDER);
    setMade((list) => list.map((x) => (x === m ? { ...x, saved: true } : x)));
  };

  const length = editLength(edit);

  return (
    <Modal title="Export" onClose={running ? () => {} : onClose} className="max-w-md">
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">Shapes</div>
          <div className="grid grid-cols-2 gap-2">
            {ASPECTS.map((a) => {
              const on = shapes.has(a.id);
              return (
                <button
                  key={a.id}
                  disabled={running}
                  onClick={() =>
                    setShapes((s) => {
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
            {made.map((m) => (
              <li key={m.url} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                <Check className="size-3.5 text-good-text" />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{m.filename}</span>
                <span className="text-[11px] tabular-nums text-faint">{(m.blob.size / 1024 / 1024).toFixed(1)} MB</span>
                <Button size="sm" variant="ghost" onClick={() => save(m)} title="Download again">
                  <Download className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={m.saved}
                  onClick={() => toLibrary(m)}
                  title={`Save to Footage › ${EXPORTS_FOLDER}, where the team can find it`}
                >
                  <FolderInput className="size-3.5" /> {m.saved ? "Saved" : "Footage"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {length > 180 && !running && !made.length && (
          <p className="text-[11px] leading-relaxed text-warning">
            This edit runs {Math.round(length / 60)} minutes. Long exports take a while and use a lot of memory; short-form
            edits export in about the time they take to play, often faster.
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
          {running ? <LoaderCircle className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {made.length ? "Export again" : shapes.size > 1 ? `Export ${shapes.size} videos` : "Export"}
        </Button>
      </div>
    </Modal>
  );
}
