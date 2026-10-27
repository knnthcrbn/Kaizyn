"use client";

import { useMemo } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { Segmented, cx } from "@/components/ui";
import type { Footage } from "@/lib/footage/types";
import { editLines, type EditLine } from "@/lib/studio/captions";
import { seek, usePlayer } from "@/lib/studio/player";
import { HIGHLIGHTS, type CaptionLook, type Edit } from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import { Slider } from "./ClipPanel";
import { precise } from "./format";

export function CaptionPanel({ edit, footage }: { edit: Edit; footage: Record<string, Footage> }) {
  const lines = useMemo(() => editLines(edit, footage), [edit, footage]);
  const set = (patch: Partial<Edit["captions"]>) =>
    useHub.getState().updateEdit(edit.id, (e) => ({ captions: { ...e.captions, ...patch } }));
  const setText = (key: string, value: string | null) =>
    useHub.getState().updateEdit(edit.id, (e) => {
      const captionText = { ...e.captionText };
      if (value == null) delete captionText[key];
      else captionText[key] = value;
      return { captionText };
    });
  const c = edit.captions;
  const noTranscript = edit.clips.length > 0 && !lines.length;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <Segmented
          value={c.look}
          onChange={(look: CaptionLook) => set({ look })}
          options={[
            { value: "bold", label: "LeadLab bold" },
            { value: "white", label: "All white" },
            { value: "off", label: "Off" },
          ]}
        />
        {c.look !== "off" && (
          <>
            {c.look === "bold" && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="w-24">Spoken word</span>
                {HIGHLIGHTS.map((h) => (
                  <button
                    key={h}
                    onClick={() => set({ highlight: h })}
                    aria-label={`Highlight ${h}`}
                    className={cx(
                      "size-6 rounded-full ring-offset-2 ring-offset-bg",
                      c.highlight === h ? "ring-2 ring-white" : "ring-1 ring-line-strong",
                    )}
                    style={{ background: h }}
                  />
                ))}
              </div>
            )}
            <Slider label="Size" value={c.size} min={0.6} max={1.4} step={0.05} onChange={(size) => set({ size })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider
              label="Height"
              value={1 - c.y}
              min={0.1}
              max={0.85}
              step={0.01}
              onChange={(v) => set({ y: 1 - v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Wording</div>
          <div className="text-[11px] text-ghost">From the library&apos;s transcripts</div>
        </div>
        {noTranscript && (
          <p className="text-xs leading-relaxed text-faint">
            These clips have no transcript yet. Captions appear once the footage library has finished listening to them.
          </p>
        )}
        {!edit.clips.length && <p className="text-xs text-faint">Add a clip and its captions show up here.</p>}
        <ul className="space-y-1">
          {lines.map((l) => (
            <Line key={l.key} line={l} onText={(v) => setText(l.key, v === l.original ? null : v || " ")} onHide={(hide) => setText(l.key, hide ? "" : null)} />
          ))}
        </ul>
        {lines.length > 0 && (
          <p className="mt-3 text-[11px] leading-relaxed text-ghost">
            Fixing a word here changes this edit only. Word timing is spread across each spoken phrase, so check fast talking in
            the preview.
          </p>
        )}
      </section>
    </div>
  );
}

function Line({ line, onText, onHide }: { line: EditLine; onText: (v: string) => void; onHide: (hide: boolean) => void }) {
  // Only this line re-renders as the playhead passes it.
  const now = usePlayer((s) => s.t >= line.start && s.t < line.end);
  const edited = !line.hidden && line.text !== line.original;
  return (
    <li className={cx("flex items-start gap-2 rounded-lg border px-2 py-1.5", now ? "border-line-strong bg-surface-2" : "border-transparent")}>
      <button
        onClick={() => seek(line.start + 1e-3)}
        className="mt-1 w-12 shrink-0 text-left font-mono text-[10px] tabular-nums text-faint hover:text-ink"
        title="Go to this line"
      >
        {precise(line.start)}
      </button>
      {line.hidden ? (
        <span className="flex-1 py-0.5 text-xs italic text-ghost line-through">{line.original}</span>
      ) : (
        <textarea
          value={line.text}
          onChange={(e) => onText(e.target.value.replace(/\n/g, " "))}
          rows={1}
          className="field-sizing-content min-h-6 flex-1 resize-none bg-transparent py-0.5 text-xs leading-relaxed text-ink focus:outline-none"
        />
      )}
      <span className="flex shrink-0">
        {edited && (
          <button onClick={() => onText(line.original)} title="Back to what was heard" className="grid size-6 place-items-center rounded text-faint hover:text-ink">
            <RotateCcw className="size-3" />
          </button>
        )}
        <button
          onClick={() => onHide(!line.hidden)}
          title={line.hidden ? "Show this line" : "Hide this line"}
          className="grid size-6 place-items-center rounded text-faint hover:text-ink"
        >
          {line.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </span>
    </li>
  );
}
