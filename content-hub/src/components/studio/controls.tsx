"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Italic, LoaderCircle, Upload } from "lucide-react";
import { cx, selectCls } from "@/components/ui";
import { FONTS, fontLabel, isUploaded, uploadedFontId } from "@/lib/studio/fonts";
import { listAssets, uploadAsset, type StoredAsset } from "@/lib/studio/ops";
import { isFontFile } from "@/lib/studio/paths";
import type { Box, Shadow, Stroke, TextLook } from "@/lib/studio/types";

// The controls behind every text setting in Studio, shaped after CapCut's:
// any colour, outline, shadow (colour, opacity, blur, distance, angle) and a
// box behind the text, each switchable.

export const SWATCHES = [
  "#FFFFFF",
  "#000000",
  "#FFE14D",
  "#3FA9FF",
  "#3DFF6E",
  "#FF3B30",
  "#FF2D95",
  "#B2B1FF",
  "#7C3AED",
  "#FF9500",
  "#00E5FF",
  "#A3A3A3",
];

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mb-2 text-[11px] font-medium uppercase tracking-wide text-faint", className)}>{children}</div>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 text-xs text-muted">
      <span>{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="grid grid-cols-[96px_1fr_44px] items-center gap-2 text-xs text-muted">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-white" />
      <span className="text-right font-mono text-[11px] tabular-nums text-faint">{format ? format(value) : value.toFixed(2)}</span>
    </label>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", on ? "bg-ink" : "bg-surface-3")}
    >
      <span className={cx("size-4 rounded-full shadow transition-transform", on ? "translate-x-[18px] bg-bg" : "translate-x-0.5 bg-faint")} />
    </button>
  );
}

/** Any colour: the browser's picker, a hex box and quick swatches. */
export function ColorField({ value, onChange, label = "Colour" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [hex, setHex] = useState(value);
  const [open, setOpen] = useState(false);
  // A colour set from outside (a preset, the picker, undo) shows in the hex box.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setHex(value);
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-line-strong" style={{ background: value }} title="Pick any colour">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
        </label>
        <input
          value={hex}
          onChange={(e) => {
            setHex(e.target.value);
            const v = e.target.value.trim();
            if (/^#?[0-9a-f]{6}$/i.test(v)) onChange((v.startsWith("#") ? v : `#${v}`).toUpperCase());
          }}
          className="h-7 w-20 rounded-md border border-line-strong bg-surface-2 px-2 font-mono text-[11px] uppercase text-ink focus:border-white/25 focus:outline-none"
          aria-label={`${label} hex`}
        />
        <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-faint hover:text-ink">
          {open ? "Fewer" : "Swatches"}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={cx("size-5 rounded-full ring-offset-2 ring-offset-bg", value.toUpperCase() === c ? "ring-2 ring-white" : "ring-1 ring-line-strong")}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A collapsible group, with an on/off switch when it can be turned off. */
export function Section({
  title,
  on,
  onToggle,
  children,
  defaultOpen = false,
}: {
  title: string;
  on?: boolean;
  onToggle?: (on: boolean) => void;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-1.5 text-left text-xs font-medium text-ink">
          <ChevronDown className={cx("size-3.5 text-faint transition-transform", !open && "-rotate-90")} />
          {title}
        </button>
        {onToggle && <Toggle on={!!on} onChange={(v) => (onToggle(v), v && setOpen(true))} label={title} />}
      </div>
      {open && <div className={cx("space-y-2.5 border-t border-line px-3 py-3", onToggle && !on && "opacity-50")}>{children}</div>}
    </div>
  );
}

/** Every font: the built-in ones, the team's uploads, and a way to add one (for Druk Wide). */
export function FontPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [uploads, setUploads] = useState<StoredAsset[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void listAssets("fonts").then(setUploads);
  }, []);
  const groups = [...new Set(FONTS.map((f) => f.group))];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(selectCls, "min-w-0 flex-1")} aria-label="Font">
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {FONTS.filter((f) => f.group === g).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
          {(uploads.length > 0 || isUploaded(value)) && (
            <optgroup label="Uploaded">
              {isUploaded(value) && !uploads.some((u) => uploadedFontId(u.path) === value) && <option value={value}>{fontLabel(value)}</option>}
              {uploads.map((u) => (
                <option key={u.path} value={uploadedFontId(u.path)}>
                  {fontLabel(uploadedFontId(u.path))}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          onClick={() => file.current?.click()}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line-strong bg-surface-2 px-2 text-xs text-ink hover:bg-surface-3"
          title="Upload a font file (.otf, .ttf, .woff2)"
        >
          {busy != null ? <LoaderCircle className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Font
        </button>
        <input
          ref={file}
          type="file"
          accept=".otf,.ttf,.woff,.woff2"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (!isFontFile(f)) return setError("That isn't a font file (.otf, .ttf, .woff or .woff2).");
            setError("");
            try {
              setBusy(0);
              const path = await uploadAsset("fonts", f, setBusy);
              setUploads((u) => [{ path, name: f.name, size: f.size, updatedAt: Date.now() }, ...u]);
              onChange(uploadedFontId(path));
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(null);
            }
          }}
        />
      </div>
      {error && <p className="text-[11px] text-critical-text">{error}</p>}
      <p className="text-[11px] leading-relaxed text-ghost">
        Druk Wide is a paid font (Commercial Type), so it can&apos;t come built in: upload the .otf you&apos;ve licensed and the whole team can use it.
        Unbounded Black is the closest free wide face.
      </p>
    </div>
  );
}

/** Font, size, colour, outline, shadow and box: the whole look of a piece of text. */
export function LookEditor({
  look,
  onChange,
  sizeRange = [30, 220],
  boxLabel = "Background",
}: {
  look: TextLook;
  onChange: (patch: Partial<TextLook>) => void;
  sizeRange?: [number, number];
  boxLabel?: string;
}) {
  const stroke = (p: Partial<Stroke>) => onChange({ stroke: { ...look.stroke, ...p } });
  const shadow = (p: Partial<Shadow>) => onChange({ shadow: { ...look.shadow, ...p } });
  const box = (p: Partial<Box>) => onChange({ box: { ...look.box, ...p } });
  return (
    <div className="space-y-3">
      <FontPicker value={look.font} onChange={(font) => onChange({ font })} />
      <Slider label="Size" value={look.size} min={sizeRange[0]} max={sizeRange[1]} step={1} onChange={(size) => onChange({ size })} format={(v) => `${Math.round(v)}`} />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onChange({ italic: !look.italic })}
          className={cx("inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs", look.italic ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-ink")}
          aria-pressed={look.italic}
        >
          <Italic className="size-3.5" /> Italic
        </button>
        <button
          onClick={() => onChange({ upper: !look.upper })}
          className={cx("h-7 rounded-md border px-2 text-xs", look.upper ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-ink")}
          aria-pressed={look.upper}
        >
          ALL CAPS
        </button>
      </div>
      <Slider label="Letter spacing" value={look.spacing} min={-0.05} max={0.4} step={0.01} onChange={(spacing) => onChange({ spacing })} format={(v) => `${Math.round(v * 100)}%`} />
      <Row label="Text colour">
        <ColorField value={look.color} onChange={(color) => onChange({ color })} />
      </Row>

      <Section title="Outline" on={look.stroke.on} onToggle={(on) => stroke({ on })}>
        <Row label="Colour">
          <ColorField value={look.stroke.color} onChange={(color) => stroke({ color })} />
        </Row>
        <Slider label="Thickness" value={look.stroke.width} min={1} max={24} step={0.5} onChange={(width) => stroke({ width })} format={(v) => `${v}`} />
      </Section>

      <Section title="Shadow" on={look.shadow.on} onToggle={(on) => shadow({ on })}>
        <Row label="Colour">
          <ColorField value={look.shadow.color} onChange={(color) => shadow({ color })} />
        </Row>
        <Slider label="Opacity" value={look.shadow.opacity} min={0} max={1} step={0.01} onChange={(opacity) => shadow({ opacity })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Blur" value={look.shadow.blur} min={0} max={60} step={1} onChange={(blur) => shadow({ blur })} format={(v) => `${v}`} />
        <Slider label="Distance" value={look.shadow.distance} min={0} max={40} step={0.5} onChange={(distance) => shadow({ distance })} format={(v) => `${v}`} />
        <Slider label="Angle" value={look.shadow.angle} min={0} max={359} step={1} onChange={(angle) => shadow({ angle })} format={(v) => `${Math.round(v)}°`} />
      </Section>

      <Section title={boxLabel} on={look.box.on} onToggle={(on) => box({ on })}>
        <Row label="Colour">
          <ColorField value={look.box.color} onChange={(color) => box({ color })} />
        </Row>
        <Slider label="Opacity" value={look.box.opacity} min={0} max={1} step={0.01} onChange={(opacity) => box({ opacity })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Corners" value={look.box.radius} min={0} max={60} step={1} onChange={(radius) => box({ radius })} format={(v) => `${v}`} />
        <Slider label="Padding" value={look.box.padX} min={0} max={80} step={1} onChange={(padX) => box({ padX, padY: Math.round(padX * 0.6) })} format={(v) => `${v}`} />
        <Row label="Border">
          <div className="flex items-center gap-2">
            <Toggle on={look.box.border.on} onChange={(on) => box({ border: { ...look.box.border, on } })} label="Border" />
            {look.box.border.on && <ColorField value={look.box.border.color} onChange={(color) => box({ border: { ...look.box.border, color } })} label="Border colour" />}
          </div>
        </Row>
        {look.box.border.on && (
          <Slider
            label="Border width"
            value={look.box.border.width}
            min={1}
            max={16}
            step={0.5}
            onChange={(width) => box({ border: { ...look.box.border, width } })}
            format={(v) => `${v}`}
          />
        )}
      </Section>
    </div>
  );
}

/** Pill buttons for a short list of choices. */
export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-7 rounded-md border px-2.5 text-xs transition-colors",
            value === o.value ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
