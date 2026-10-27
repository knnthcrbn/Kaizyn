"use client";

import { useMemo } from "react";
import { Eye, EyeOff, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { Button, cx } from "@/components/ui";
import type { Footage } from "@/lib/footage/types";
import { editLines, type EditLine } from "@/lib/studio/captions";
import { runJob, useJob } from "@/lib/studio/jobs";
import { autoCaptions, captionsStale } from "@/lib/studio/ops";
import { seek, usePlayer } from "@/lib/studio/player";
import { CAPTION_PRESETS } from "@/lib/studio/presets";
import { newUndoStep } from "@/lib/studio/undo";
import { withDefaults, type CaptionAnim, type Edit, type EditCaptions, type TextLook } from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import { Chips, ColorField, Label, LookEditor, Row, Section, Slider, Toggle } from "./controls";
import { precise } from "./format";
import { StyleSample } from "./StyleSample";

const ANIMATIONS: { value: CaptionAnim; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pop", label: "Pop" },
  { value: "bounce", label: "Bounce" },
  { value: "rise", label: "Rise" },
  { value: "slide", label: "Slide" },
  { value: "fade", label: "Fade" },
  { value: "typewriter", label: "Word by word" },
  { value: "zoom", label: "Zoom" },
];

export function startAutoCaptions(editId: string) {
  return runJob("Auto captions", async (progress) => {
    const r = await autoCaptions(editId, progress);
    if (!r.words) return "No speech was heard in these clips.";
    return r.timed
      ? `Captioned ${r.words} words, each timed as it's said.`
      : `Captioned ${r.words} words. Word timing wasn't available in this browser, so each phrase's words are spread across it.`;
  });
}

export function CaptionPanel({ edit, footage }: { edit: Edit; footage: Record<string, Footage> }) {
  const lines = useMemo(() => editLines(edit, footage), [edit, footage]);
  const job = useJob();
  const c = edit.captions;
  const set = (patch: Partial<EditCaptions>) =>
    useHub.getState().updateEdit(edit.id, (e) => ({ captions: { ...withDefaults(e).captions, ...patch } }));
  const setStyle = (patch: Partial<TextLook>) =>
    useHub.getState().updateEdit(edit.id, (e) => {
      const cur = withDefaults(e).captions;
      return { captions: { ...cur, style: { ...cur.style, ...patch } } };
    });
  const setHi = (patch: Partial<EditCaptions["highlight"]>) =>
    useHub.getState().updateEdit(edit.id, (e) => {
      const cur = withDefaults(e).captions;
      return { captions: { ...cur, highlight: { ...cur.highlight, ...patch } } };
    });
  const setText = (key: string, value: string | null) =>
    useHub.getState().updateEdit(edit.id, (e) => {
      const captionText = { ...e.captionText };
      if (value == null) delete captionText[key];
      else captionText[key] = value;
      return { captionText };
    });
  const timed = edit.clips.some((x) => x.words?.length);
  const stale = edit.clips.filter(captionsStale).length;

  return (
    <div className="space-y-5">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Captions</span>
          <Toggle on={c.on} onChange={(on) => set({ on })} label="Captions on" />
        </div>
        <Button variant="ai" className="w-full" disabled={!!job.label || !edit.clips.length} onClick={() => void startAutoCaptions(edit.id)}>
          <Sparkles className="size-3.5" /> {timed ? "Listen again (auto captions)" : "Auto captions"}
        </Button>
        <p className="text-[11px] leading-relaxed text-ghost">
          {timed
            ? "Timed word by word from the video's own sound, like CapCut."
            : "Using the library's transcripts for now (timed by phrase). Auto captions listens to the clips in this browser and times every word; the first run downloads the speech model."}
        </p>
        {stale > 0 && (
          <p className="flex items-start gap-1.5 text-[11px] text-warning">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            {stale === 1 ? "A clip was" : `${stale} clips were`} trimmed wider than its captions reach. Run auto captions again.
          </p>
        )}
      </section>

      {c.on && (
        <>
          <section>
            <Label>Styles</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {CAPTION_PRESETS.map((p) => {
                const made = p.make();
                return (
                  <StyleSample
                    key={p.id}
                    label={p.label}
                    look={made.style}
                    text="say THIS"
                    highlight={made.highlight.on && made.highlight.mode === "color" ? made.highlight.color : null}
                    onClick={() => (newUndoStep(), set({ ...made, y: c.y }))}
                  />
                );
              })}
            </div>
          </section>

          <Section title="Spoken word" on={c.highlight.on} onToggle={(on) => setHi({ on })} defaultOpen>
            <Chips
              value={c.highlight.mode}
              onChange={(mode) => setHi({ mode })}
              options={[
                { value: "color", label: "Colour the word" },
                { value: "box", label: "Box behind it" },
              ]}
            />
            <Row label={c.highlight.mode === "box" ? "Word colour" : "Colour"}>
              <ColorField value={c.highlight.color} onChange={(color) => setHi({ color })} />
            </Row>
            {c.highlight.mode === "box" && (
              <Row label="Box colour">
                <ColorField value={c.highlight.boxColor} onChange={(boxColor) => setHi({ boxColor })} />
              </Row>
            )}
            <Slider label="Grow" value={c.highlight.scale} min={1} max={1.4} step={0.01} onChange={(scale) => setHi({ scale })} format={(v) => `${Math.round(v * 100)}%`} />
          </Section>

          <section>
            <Label>Animation</Label>
            <Chips value={c.animation} onChange={(animation) => set({ animation })} options={ANIMATIONS} />
          </section>

          <section>
            <Label>Text</Label>
            <LookEditor look={c.style} onChange={setStyle} />
          </section>

          <section className="space-y-2.5">
            <Label>Layout</Label>
            <Slider label="Words at once" value={c.words} min={1} max={8} step={1} onChange={(words) => set({ words })} format={(v) => `${v}`} />
            <Slider label="Height" value={1 - c.y} min={0.05} max={0.9} step={0.01} onChange={(v) => set({ y: 1 - v })} format={(v) => `${Math.round(v * 100)}%`} />
          </section>
        </>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <Label className="mb-0">Wording</Label>
          <span className="text-[11px] text-ghost">{timed ? "Auto captions" : "Library transcripts"}</span>
        </div>
        {!edit.clips.length && <p className="text-xs text-faint">Add a clip and its captions show up here.</p>}
        {edit.clips.length > 0 && !lines.length && (
          <p className="text-xs leading-relaxed text-faint">Nothing to caption yet. Run auto captions, or wait for the footage library to finish listening.</p>
        )}
        <ul className="space-y-1">
          {lines.map((l) => (
            <Line
              key={l.key}
              line={l}
              // An emptied line keeps a space: "" is how a hidden line is stored.
              onText={(v) => setText(l.key, v === l.original ? null : v || " ")}
              onHide={(hide) => setText(l.key, hide ? "" : null)}
            />
          ))}
        </ul>
        {lines.length > 0 && <p className="mt-3 text-[11px] leading-relaxed text-ghost">Fixing a word here changes this edit only.</p>}
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
      <button onClick={() => seek(line.start + 1e-3)} className="mt-1 w-12 shrink-0 text-left font-mono text-[10px] tabular-nums text-faint hover:text-ink" title="Go to this line">
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
        <button onClick={() => onHide(!line.hidden)} title={line.hidden ? "Show this line" : "Hide this line"} className="grid size-6 place-items-center rounded text-faint hover:text-ink">
          {line.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </span>
    </li>
  );
}
