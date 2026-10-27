"use client";

import type { CSSProperties } from "react";
import { cx } from "@/components/ui";
import { cssFamily, cssWeight } from "@/lib/studio/fonts";
import { rgba } from "@/lib/studio/render";
import type { TextLook } from "@/lib/studio/types";

/** A word or two drawn in a text style with CSS, so presets can be picked by eye. */
export function StyleSample({
  look,
  text,
  highlight,
  className,
  onClick,
  active,
  label,
}: {
  look: TextLook;
  text: string;
  /** Colour of the second word, as the spoken word. */
  highlight?: string | null;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  label: string;
}) {
  const size = Math.max(11, Math.min(22, look.size * 0.17));
  const rad = (look.shadow.angle * Math.PI) / 180;
  const style: CSSProperties = {
    fontFamily: cssFamily(look.font),
    fontWeight: cssWeight(look.font),
    fontStyle: look.italic ? "italic" : "normal",
    fontSize: size,
    letterSpacing: `${look.spacing}em`,
    textTransform: look.upper ? "uppercase" : "none",
    color: look.color,
    WebkitTextStroke: look.stroke.on ? `${Math.max(0.5, look.stroke.width * 0.12)}px ${look.stroke.color}` : undefined,
    paintOrder: "stroke fill",
    textShadow: look.shadow.on
      ? `${(Math.cos(rad) * look.shadow.distance * 0.2).toFixed(1)}px ${(Math.sin(rad) * look.shadow.distance * 0.2).toFixed(1)}px ${look.shadow.blur * 0.2}px ${rgba(look.shadow.color, look.shadow.opacity)}`
      : undefined,
    background: look.box.on ? rgba(look.box.color, look.box.opacity) : undefined,
    border: look.box.on && look.box.border.on ? `${Math.max(1, look.box.border.width * 0.2)}px solid ${look.box.border.color}` : undefined,
    borderRadius: look.box.on ? look.box.radius * 0.2 : undefined,
    padding: look.box.on ? "1px 6px" : undefined,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
  const [first, ...rest] = text.split(" ");
  return (
    <button
      onClick={onClick}
      title={label}
      className={cx(
        "flex h-14 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border bg-[radial-gradient(120%_90%_at_30%_20%,#3a3a40_0%,#1b1b1f_60%,#0f0f11_100%)] px-1",
        active ? "border-white/70" : "border-line hover:border-line-strong",
        className,
      )}
    >
      <span style={style}>
        {first}{" "}
        <span style={highlight ? { color: highlight } : undefined}>{rest.join(" ")}</span>
      </span>
      <span className="text-[9px] text-faint">{label}</span>
    </button>
  );
}
