"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cx, inputCls, selectCls } from "@/components/ui";
import { HOOK_PRESETS } from "@/lib/studio/presets";
import { newUndoStep } from "@/lib/studio/undo";
import { withDefaults, type Edit, type EditOverlay, type TextAnim, type TextLook } from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import { Chips, Label, LookEditor, Slider } from "./controls";
import { StyleSample } from "./StyleSample";

const ANIMATIONS: { value: TextAnim; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pop", label: "Pop" },
  { value: "rise", label: "Rise" },
  { value: "slide", label: "Slide" },
  { value: "fade", label: "Fade" },
  { value: "typewriter", label: "Typewriter" },
];

export function TextPanel({ edit }: { edit: Edit }) {
  const cards = useHub((s) => s.items);
  const card = edit.cardId ? cards.find((c) => c.id === edit.cardId) : undefined;
  const open = cards.filter((c) => !["posted", "analysed"].includes(c.stage) || c.id === edit.cardId);
  const o = edit.overlay;
  const update = (patch: Partial<Edit>) => useHub.getState().updateEdit(edit.id, patch);
  const setOverlay = (patch: Partial<EditOverlay>) =>
    useHub.getState().updateEdit(edit.id, (e) => ({ overlay: { ...withDefaults(e).overlay, ...patch } }));
  const setStyle = (patch: Partial<TextLook>) =>
    useHub.getState().updateEdit(edit.id, (e) => {
      const cur = withDefaults(e).overlay;
      return { overlay: { ...cur, style: { ...cur.style, ...patch } } };
    });
  // Lines worth one tap: the card's overlay and its hooks.
  const options = card ? [...new Set([card.overlay, ...card.hooks].map((x) => x?.trim()).filter(Boolean))] : [];
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
        <Label>Text on screen</Label>
        <textarea
          value={o.text}
          onChange={(e) => setOverlay({ text: e.target.value })}
          rows={3}
          placeholder="The hook, e.g. 'Go broad' is why your CPA doubled"
          className={cx(inputCls, "resize-none")}
        />
        {options.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[11px] text-ghost">From the card</div>
            {options.map((x) => (
              <button
                key={x}
                onClick={() => setOverlay({ text: x })}
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

      {o.text.trim() && (
        <>
          <section>
            <Label>Styles</Label>
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
            <Chips
              value={String(o.until)}
              onChange={(v) => setOverlay({ until: Number(v) })}
              options={[
                { value: "0", label: "Whole video" },
                { value: "3", label: "First 3s" },
                { value: "5", label: "First 5s" },
                { value: "8", label: "First 8s" },
              ]}
            />
            {o.until > 0 && <Slider label="Shows for" value={o.until} min={1} max={30} step={0.5} onChange={(until) => setOverlay({ until })} format={(v) => `${v}s`} />}
            <Chips
              value={o.y < 0.3 ? "top" : o.y > 0.7 ? "bottom" : "middle"}
              onChange={(v) => setOverlay({ y: v === "top" ? (vertical ? 0.18 : 0.12) : v === "middle" ? 0.42 : 0.82 })}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
                { value: "bottom", label: "Bottom" },
              ]}
            />
            <Slider label="Height" value={1 - o.y} min={0.05} max={0.95} step={0.01} onChange={(v) => setOverlay({ y: 1 - v })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Line width" value={o.width} min={0.3} max={0.95} step={0.01} onChange={(width) => setOverlay({ width })} format={(v) => `${Math.round(v * 100)}%`} />
          </section>

          <section>
            <Label>Text</Label>
            <LookEditor look={o.style} onChange={setStyle} sizeRange={[24, 160]} boxLabel="Box" />
          </section>

          <p className="text-[11px] leading-relaxed text-ghost">For trial reels: export once, change the text, export again. Same video, different hook.</p>
        </>
      )}
    </div>
  );
}
