"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, LoaderCircle, Plus, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button, cx, inputCls, selectCls } from "@/components/ui";
import type { Footage } from "@/lib/footage/types";
import { HOOK_PRESETS } from "@/lib/studio/presets";
import { newUndoStep } from "@/lib/studio/undo";
import {
  SUBHEAD_BLUE,
  VERSION_LABELS,
  keptRanges,
  withDefaults,
  type Edit,
  type EditOverlay,
  type EditSubhead,
  type TextAnim,
  type TextLook,
} from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import type { ContentItem } from "@/lib/types";
import { Chips, Label, LookEditor, Slider, Toggle } from "./controls";
import { StyleSample } from "./StyleSample";

const ANIMATIONS: { value: TextAnim; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pop", label: "Pop" },
  { value: "rise", label: "Rise" },
  { value: "slide", label: "Slide" },
  { value: "fade", label: "Fade" },
  { value: "typewriter", label: "Typewriter" },
];

const TIMINGS = [
  { value: "0", label: "Whole video" },
  { value: "3", label: "First 3s" },
  { value: "5", label: "First 5s" },
  { value: "8", label: "First 8s" },
];

const MAX_VERSIONS = VERSION_LABELS.length;

// The sub-headline's box: Instagram's blue first, with white words on it.
const SUB_BOXES: { id: string; label: string; box: string | null; text: string }[] = [
  { id: "blue", label: "Blue", box: SUBHEAD_BLUE, text: "#FFFFFF" },
  { id: "black", label: "Black", box: "#000000", text: "#FFFFFF" },
  { id: "white", label: "White", box: "#FFFFFF", text: "#000000" },
  { id: "red", label: "Red", box: "#FF3B30", text: "#FFFFFF" },
  { id: "yellow", label: "Yellow", box: "#FFE14D", text: "#000000" },
  { id: "none", label: "None", box: null, text: "#FFFFFF" },
];

/** What's said in the edit (only the parts kept), for Claude to write lines that match it. */
function spokenText(edit: Edit, footage: Record<string, Footage | undefined>) {
  const parts: string[] = [];
  for (const c of edit.clips) {
    const kept = keptRanges(c);
    const inside = (a: number, b: number) => kept.some(([x, y]) => b > x && a < y);
    if (c.words?.length)
      parts.push(
        c.words
          .filter((w) => inside(w.start, w.end))
          .map((w) => w.text)
          .join(" "),
      );
    else
      parts.push(
        (footage[c.footageId]?.transcript ?? [])
          .filter((l) => inside(l.start, l.end))
          .map((l) => l.text)
          .join(" "),
      );
  }
  return parts.filter(Boolean).join(" ").slice(0, 3000);
}

const change = (id: string, fn: (e: Edit) => Partial<Edit>) => useHub.getState().updateEdit(id, (e) => fn(withDefaults(e)));

/** Which version is on screen: the one matching the hook's text. */
const shownIndex = (e: Pick<Edit, "versions" | "overlay">) => (e.versions ?? []).findIndex((v) => v.trim() && v.trim() === e.overlay.text.trim());

export function TextPanel({ edit, footage }: { edit: Edit; footage: Record<string, Footage | undefined> }) {
  const cards = useHub((s) => s.items);
  const card = edit.cardId ? cards.find((c) => c.id === edit.cardId) : undefined;
  const open = cards.filter((c) => !["posted", "analysed"].includes(c.stage) || c.id === edit.cardId);
  const o = edit.overlay;
  const versions = edit.versions ?? [];
  const update = (patch: Partial<Edit>) => useHub.getState().updateEdit(edit.id, patch);
  const setOverlay = (patch: Partial<EditOverlay>) => change(edit.id, (e) => ({ overlay: { ...e.overlay, ...patch } }));
  const setStyle = (patch: Partial<TextLook>) => change(edit.id, (e) => ({ overlay: { ...e.overlay, style: { ...e.overlay.style, ...patch } } }));
  // Typing in the hook box edits the version on screen too, so the two never disagree.
  const setHookText = (text: string) =>
    change(edit.id, (e) => {
      const i = shownIndex(e);
      if (i < 0) return { overlay: { ...e.overlay, text } };
      const list = [...(e.versions ?? [])];
      list[i] = text;
      return { overlay: { ...e.overlay, text }, versions: list };
    });
  // Lines worth one tap: the card's overlay and its hooks.
  const options = card ? [...new Set([card.overlay, ...card.hooks].map((x) => x?.trim()).filter(Boolean))] : [];
  const pickOption = (x: string) => {
    if (!versions.length) return setOverlay({ text: x });
    // Testing: a line from the card joins the versions (once) and goes on screen.
    change(edit.id, (e) => {
      const list = e.versions ?? [];
      return { versions: list.some((v) => v.trim() === x) ? list : [...list, x].slice(0, MAX_VERSIONS), overlay: { ...e.overlay, text: x } };
    });
  };
  const vertical = edit.aspect !== "16:9";

  return (
    <div className="space-y-5">
      <section>
        <Label>For card</Label>
        <select
          value={edit.cardId ?? ""}
          onChange={(e) => {
            const next = cards.find((c) => c.id === e.target.value);
            update({
              cardId: next?.id,
              // An untitled edit takes the card's name.
              ...(next && (!edit.title || edit.title === "Untitled edit") ? { title: next.title } : {}),
            });
          }}
          className={cx(selectCls, "w-full")}
        >
          <option value="">No card</option>
          {open.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </section>

      <section>
        <Label>Banner (the hook on screen)</Label>
        <textarea
          value={o.text}
          onChange={(e) => setHookText(e.target.value)}
          rows={3}
          placeholder="The hook, e.g. 'Go broad' is why your CPA doubled"
          className={cx(inputCls, "resize-none")}
          data-hook-input
        />
        {options.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[11px] text-ghost">From the card{versions.length ? " (adds a version)" : ""}</div>
            {options.map((x) => (
              <button
                key={x}
                onClick={() => pickOption(x)}
                className={cx(
                  "block w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                  o.text === x ? "border-line-strong bg-surface-2 text-ink" : "border-line text-muted hover:text-ink",
                )}
              >
                {x}
              </button>
            ))}
          </div>
        )}
        <Link href="/hooks" className="mt-2 inline-flex items-center gap-1 text-[11px] text-faint hover:text-ink">
          Browse hook and overlay patterns <ArrowUpRight className="size-3" />
        </Link>
      </section>

      <Versions edit={edit} footage={footage} card={card} />

      <Subhead edit={edit} />

      {o.text.trim() && (
        <>
          <section>
            <Label>Banner style</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {HOOK_PRESETS.map((p) => {
                const made = p.make();
                return <StyleSample key={p.id} label={p.label} look={made.style!} text="Your hook here" onClick={() => (newUndoStep(), setOverlay(made))} />;
              })}
            </div>
          </section>

          <section>
            <Label>Animation</Label>
            <Chips value={o.animation} onChange={(animation) => setOverlay({ animation })} options={ANIMATIONS} />
          </section>

          <section className="space-y-2.5">
            <Label>Timing and place</Label>
            <Chips value={String(o.until)} onChange={(v) => setOverlay({ until: Number(v) })} options={TIMINGS} />
            {o.until > 0 && (
              <Slider label="Shows for" value={o.until} min={1} max={30} step={0.5} onChange={(until) => setOverlay({ until })} format={(v) => `${v}s`} />
            )}
            <Chips
              value={o.y < 0.3 ? "top" : o.y > 0.7 ? "bottom" : "middle"}
              onChange={(v) => setOverlay({ y: v === "top" ? (vertical ? 0.18 : 0.12) : v === "middle" ? 0.42 : 0.82 })}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
                { value: "bottom", label: "Bottom" },
              ]}
            />
            <Slider
              label="Height"
              value={1 - o.y}
              min={0.05}
              max={0.95}
              step={0.01}
              onChange={(v) => setOverlay({ y: 1 - v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Slider
              label="Line width"
              value={o.width}
              min={0.3}
              max={0.95}
              step={0.01}
              onChange={(width) => setOverlay({ width })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </section>

          <section>
            <Label>Banner text</Label>
            <LookEditor look={o.style} onChange={setStyle} sizeRange={[24, 160]} boxLabel="Box" />
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Other hook lines to test: one video each, everything else the same. Export
 * makes them all at once and lines them up as trial reels.
 */
function Versions({ edit, footage, card }: { edit: Edit; footage: Record<string, Footage | undefined>; card?: ContentItem }) {
  const voice = useHub((s) => s.voiceProfile);
  const versions = edit.versions ?? [];
  const shown = shownIndex(edit);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = versions.filter((v) => v.trim()).length;
  // Five to test is the usual; past that, a few more at a time.
  const ask = Math.max(1, Math.min(MAX_VERSIONS - Math.max(filled, 1), filled < 5 ? 5 - Math.max(filled, 1) : 3));
  const room = filled < MAX_VERSIONS;

  const setRow = (i: number, value: string) =>
    change(edit.id, (e) => {
      const list = [...(e.versions ?? [])];
      const onScreen = i === shownIndex(e);
      list[i] = value;
      return onScreen ? { versions: list, overlay: { ...e.overlay, text: value } } : { versions: list };
    });
  const show = (i: number) => change(edit.id, (e) => ({ overlay: { ...e.overlay, text: (e.versions ?? [])[i] ?? e.overlay.text } }));
  const remove = (i: number) =>
    change(edit.id, (e) => {
      const list = (e.versions ?? []).filter((_, j) => j !== i);
      const wasShown = i === shownIndex(e);
      // One line left isn't a test: it's just the hook.
      if (list.length < 2) return { versions: [], overlay: { ...e.overlay, text: list[0] ?? e.overlay.text } };
      return wasShown ? { versions: list, overlay: { ...e.overlay, text: list[0] } } : { versions: list };
    });
  const add = () => change(edit.id, (e) => ({ versions: [...(e.versions?.length ? e.versions : [e.overlay.text]), ""].slice(0, MAX_VERSIONS) }));

  const write = async () => {
    setWriting(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: edit.overlay.text,
          subhead: edit.subhead?.text,
          have: versions.length ? versions : [edit.overlay.text],
          title: card?.title ?? edit.title,
          script: card?.script,
          spoken: spokenText(edit, footage),
          voice,
          count: ask,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { lines?: { text: string }[]; error?: string };
      if (!res.ok || !data.lines) throw new Error(data.error || "Claude couldn't write them just now.");
      const lines = data.lines.map((l) => l.text);
      newUndoStep();
      change(edit.id, (e) => {
        const base = (e.versions?.length ? e.versions : [e.overlay.text]).filter((v) => v.trim());
        const list = [...base, ...lines].slice(0, MAX_VERSIONS);
        // No banner yet: the first line goes on screen.
        return e.overlay.text.trim() ? { versions: list } : { versions: list, overlay: { ...e.overlay, text: list[0] ?? "" } };
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWriting(false);
    }
  };

  const writeButton = (
    <Button size="sm" variant="ai" onClick={write} disabled={writing || !room} data-versions-write>
      {writing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Write {ask} with Claude
    </Button>
  );

  if (!versions.length) {
    return (
      <section className="rounded-lg border border-dashed border-line p-3" data-versions>
        <div className="text-xs text-ink">Test other banners</div>
        <p className="mt-1 text-[11px] leading-relaxed text-faint">
          Add other lines to try. Export makes one video for each, everything else the same, and lines them up as trial reels.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" onClick={add} data-versions-add>
            <Plus className="size-3.5" /> Add a version
          </Button>
          {writeButton}
        </div>
        {error && <ErrorLine text={error} />}
      </section>
    );
  }

  return (
    <section data-versions>
      <Label>Versions to test · {filled}</Label>
      <ul className="space-y-1.5">
        {versions.map((v, i) => (
          <li key={i} className="flex items-start gap-1.5" data-version-row>
            <button
              onClick={() => show(i)}
              disabled={!v.trim()}
              title={i === shown ? "On screen now" : "Show this one"}
              className={cx(
                "mt-1 grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold transition-colors",
                i === shown ? "bg-ink text-bg" : "bg-surface-3 text-muted hover:text-ink",
              )}
              data-version-show
            >
              {VERSION_LABELS[i]}
            </button>
            <textarea
              value={v}
              onChange={(e) => setRow(i, e.target.value)}
              rows={1}
              placeholder="Another line to try"
              className={cx(inputCls, "min-h-8 resize-none py-1.5 text-xs [field-sizing:content]")}
              data-version-input
            />
            <button onClick={() => remove(i)} className="mt-1 rounded p-1 text-faint hover:text-ink" aria-label={`Remove version ${VERSION_LABELS[i]}`}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {room && (
          <Button size="sm" variant="ghost" onClick={add} data-versions-add>
            <Plus className="size-3.5" /> Add
          </Button>
        )}
        {room && writeButton}
      </div>
      {error && <ErrorLine text={error} />}
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ghost">
        <Eye className="mt-0.5 size-3 shrink-0" />
        Tap a letter to see it on the video. Export makes all {filled} at once.
      </p>
    </section>
  );
}

const ErrorLine = ({ text }: { text: string }) => (
  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-critical-text">
    <TriangleAlert className="mt-0.5 size-3 shrink-0" />
    {text}
  </p>
);

/** The line under the banner: the same in every version. */
function Subhead({ edit }: { edit: Edit }) {
  const sub = withDefaults(edit).subhead!;
  const setSub = (patch: Partial<EditSubhead>) => change(edit.id, (e) => ({ subhead: { ...e.subhead!, ...patch } }));
  const setSubStyle = (patch: Partial<TextLook>) => change(edit.id, (e) => ({ subhead: { ...e.subhead!, style: { ...e.subhead!.style, ...patch } } }));
  const current = SUB_BOXES.find((b) => (b.box ? sub.style.box.on && sub.style.box.color.toUpperCase() === b.box.toUpperCase() : !sub.style.box.on))?.id;

  return (
    <section className="space-y-2.5">
      <Label className="mb-0">Line under it</Label>
      <textarea
        value={sub.text}
        onChange={(e) => setSub({ text: e.target.value })}
        rows={2}
        placeholder="Optional, e.g. Most people get this wrong"
        className={cx(inputCls, "resize-none")}
        data-subhead-input
      />
      {sub.text.trim() && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {SUB_BOXES.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  newUndoStep();
                  setSubStyle({ color: b.text, box: { ...sub.style.box, on: !!b.box, color: b.box ?? sub.style.box.color } });
                }}
                className={cx(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
                  current === b.id ? "border-line-strong bg-surface-2 text-ink" : "border-line text-muted hover:text-ink",
                )}
                data-subhead-box={b.id}
              >
                <span className="size-3 rounded-sm ring-1 ring-line-strong" style={{ background: b.box ?? "transparent" }} />
                {b.label}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-2 text-xs text-muted">
            Sits right under the banner
            <Toggle on={sub.follow} onChange={(follow) => setSub({ follow })} label="Sits right under the banner" />
          </label>
          {sub.follow ? (
            <Slider label="Space above" value={sub.gap} min={0} max={80} step={1} onChange={(gap) => setSub({ gap })} format={(v) => `${v}`} />
          ) : (
            <Slider
              label="Height"
              value={1 - sub.y}
              min={0.05}
              max={0.95}
              step={0.01}
              onChange={(v) => setSub({ y: 1 - v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          )}
          <Slider label="Size" value={sub.style.size} min={20} max={120} step={1} onChange={(size) => setSubStyle({ size })} format={(v) => `${v}`} />
          <Chips value={String(sub.until)} onChange={(v) => setSub({ until: Number(v) })} options={TIMINGS} />
          <details className="group">
            <summary className="cursor-pointer text-[11px] text-faint hover:text-ink">More styling</summary>
            <div className="mt-2.5">
              <LookEditor look={sub.style} onChange={setSubStyle} sizeRange={[20, 120]} boxLabel="Box" />
            </div>
          </details>
        </>
      )}
    </section>
  );
}
