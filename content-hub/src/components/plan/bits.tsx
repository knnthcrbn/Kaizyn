"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { PLATFORMS, platformHex, platformLabel } from "@/lib/plan";
import type { Platform } from "@/lib/types";

export function PlatformDot({ platform, className }: { platform: Platform; className?: string }) {
  return <span className={cx("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: platformHex(platform) }} title={platformLabel(platform)} />;
}

export function PlatformName({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <PlatformDot platform={platform} />
      {platformLabel(platform)}
    </span>
  );
}

/** Small uppercase label over a field, like the Studio panels. */
export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint", className)}>{children}</div>;
}

export function PlatformChips({
  value,
  onChange,
  only,
  multi,
}: {
  value: Platform[];
  onChange: (v: Platform[]) => void;
  /** Limit to these. */
  only?: Platform[];
  multi?: boolean;
}) {
  const list = only ? PLATFORMS.filter((p) => only.includes(p.id)) : PLATFORMS;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== p.id) : [...value, p.id]) : [p.id])}
            className={cx(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
              on ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-ink",
            )}
            aria-pressed={on}
          >
            <PlatformDot platform={p.id} />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/** Reads "12,400", "12.4k" or "1.2m" the way people copy them off the app. */
export function parseCount(raw: string, max?: number) {
  const m = raw.replace(/[,\s]/g, "").toLowerCase().match(/^(\d*\.?\d+)([km])?%?$/);
  if (!m) return null;
  let n = parseFloat(m[1]) * (m[2] === "k" ? 1000 : m[2] === "m" ? 1_000_000 : 1);
  if (max != null) n = Math.min(max, n);
  return Math.round(n * 10) / 10;
}

/** A number box that keeps empty as empty (not 0), for results not read yet. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  max,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  max?: number;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  // A value set from outside (another field, a reset) shows here.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    if (parseCount(text, max) !== (value ?? null)) setText(value == null ? "" : String(value));
  }
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-faint">{label}</span>
      <span className="flex items-center rounded-lg border border-line-strong bg-surface-2 focus-within:border-white/25">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value.trim()) return onChange(undefined);
            const n = parseCount(e.target.value, max);
            if (n != null) onChange(n);
          }}
          className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[13px] tabular-nums text-ink focus:outline-none"
          placeholder="–"
          aria-label={label}
        />
        {suffix && <span className="pr-2.5 text-xs text-faint">{suffix}</span>}
      </span>
    </label>
  );
}
