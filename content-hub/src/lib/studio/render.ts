"use client";

// Draws one frame of an edit. The preview and the export both call this, so
// what plays in the Studio is exactly what gets exported.
//
// Sizes are in pixels on a 1080 frame (LeadLab Studio's units: 108px
// captions, a 7px outline) and scale with the frame, so a small preview
// canvas looks the same as the export.
import { captionAt, type CapGroup, type CapWord } from "./captions";
import { ensureFont, fontSpec } from "./fonts";
import { zoomAt, type Edit, type EditClip, type Shadow, type TextLook } from "./types";

export interface Picture {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** Waits for an edit's fonts, so the first frames aren't drawn in a fallback face. */
export async function loadFonts(edit?: Pick<Edit, "captions" | "overlay">) {
  await Promise.all([ensureFont("montserrat"), ensureFont("geist"), ...(edit ? [ensureFont(edit.captions.style.font), ensureFont(edit.overlay.style.font)] : [])]);
}

/** One unit = one pixel on a 1080-wide (or 1080-tall) frame. */
const unit = (W: number, H: number) => Math.min(W, H) / 1080;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const easeOutBack = (x: number) => {
  const p = clamp01(x) - 1;
  return 1 + 2.4 * p ** 3 + 1.4 * p ** 2;
};

/** "#ffcc00" plus an opacity, as rgba(). */
export function rgba(hex: string, a = 1) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Where a clip's picture lands: cover or contain, zoomed, with its subject kept in view. */
export function placement(W: number, H: number, sw: number, sh: number, clip: Pick<EditClip, "fit" | "focus" | "zoom">, cover: boolean, extra = 1) {
  const scale = (cover ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh)) * Math.max(1, clip.zoom) * extra;
  const dw = sw * scale;
  const dh = sh * scale;
  // Centre on the subject, then keep the picture covering the frame where it can.
  const place = (frame: number, size: number, focus: number) => {
    if (size <= frame) return (frame - size) / 2;
    return Math.min(0, Math.max(frame - size, frame / 2 - focus * size));
  };
  return { x: place(W, dw, clip.focus.x), y: place(H, dh, clip.focus.y), w: dw, h: dh };
}

function drawPicture(ctx: CanvasRenderingContext2D, W: number, H: number, pic: Picture, clip: EditClip, punch: number) {
  if (clip.fit === "fit") {
    // The whole picture, over a darkened, blurred copy of itself filling the frame.
    const bg = placement(W, H, pic.width, pic.height, { fit: "fill", focus: clip.focus, zoom: 1.08 }, true);
    ctx.save();
    ctx.filter = `blur(${Math.round(unit(W, H) * 36)}px) brightness(0.55)`;
    ctx.drawImage(pic.image, bg.x, bg.y, bg.w, bg.h);
    ctx.restore();
    const fg = placement(W, H, pic.width, pic.height, clip, false, punch);
    ctx.drawImage(pic.image, fg.x, fg.y, fg.w, fg.h);
    return;
  }
  const p = placement(W, H, pic.width, pic.height, clip, true, punch);
  ctx.drawImage(pic.image, p.x, p.y, p.w, p.h);
}

// ------------------------------------------------------------------ text

function setShadow(ctx: CanvasRenderingContext2D, sh: Shadow | null, u: number) {
  if (!sh || !sh.on || sh.opacity <= 0) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }
  const rad = (sh.angle * Math.PI) / 180;
  ctx.shadowColor = rgba(sh.color, sh.opacity);
  ctx.shadowBlur = sh.blur * u;
  ctx.shadowOffsetX = Math.cos(rad) * sh.distance * u;
  ctx.shadowOffsetY = Math.sin(rad) * sh.distance * u;
}

function setFont(ctx: CanvasRenderingContext2D, look: TextLook, px: number) {
  ctx.font = fontSpec(look.font, px, look.italic);
  // Letter spacing where the browser draws it (Chrome, Edge, Safari 17+).
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${look.spacing * px}px`;
}

/** Outline under fill, the shadow cast by whichever is drawn first, the way CapCut stacks them. */
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, look: TextLook, fill: string, u: number, shadow: boolean, scale = 1) {
  setShadow(ctx, shadow ? look.shadow : null, u);
  if (look.stroke.on && look.stroke.width > 0) {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = look.stroke.width * 2 * u * scale;
    ctx.strokeStyle = look.stroke.color;
    ctx.strokeText(text, x, y);
    setShadow(ctx, null, u);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  setShadow(ctx, null, u);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, look: TextLook, u: number) {
  const b = look.box;
  setShadow(ctx, look.shadow, u);
  roundRect(ctx, x, y, w, h, b.radius * u);
  ctx.fillStyle = rgba(b.color, b.opacity);
  ctx.fill();
  setShadow(ctx, null, u);
  if (b.border.on && b.border.width > 0) {
    ctx.lineWidth = b.border.width * u;
    ctx.strokeStyle = b.border.color;
    ctx.stroke();
  }
}

/** Splits words into one line, or two balanced ones, to fit `max`. */
function breakLines(widths: number[], space: number, max: number): number[][] {
  const all = widths.map((_, i) => i);
  const width = (ix: number[]) => ix.reduce((n, i) => n + widths[i], 0) + space * Math.max(0, ix.length - 1);
  if (width(all) <= max || widths.length < 2) return [all];
  let best = [all.slice(0, 1), all.slice(1)];
  let bestW = Infinity;
  for (let k = 1; k < widths.length; k++) {
    const a = all.slice(0, k);
    const b = all.slice(k);
    const w = Math.max(width(a), width(b));
    if (w < bestW) {
      bestW = w;
      best = [a, b];
    }
  }
  return best;
}

function drawCaption(ctx: CanvasRenderingContext2D, W: number, H: number, edit: Edit, groups: CapGroup[], t: number) {
  const now = captionAt(groups, t);
  if (!now) return;
  const cap = edit.captions;
  const look = cap.style;
  const u = unit(W, H);
  const g = now.group;
  const texts = g.words.map((w) => (look.upper ? w.text.toUpperCase() : w.text));

  let px = look.size * u;
  setFont(ctx, look, px);
  const max = W * 0.9;
  let widths = texts.map((s) => ctx.measureText(s).width);
  let space = ctx.measureText(" ").width;
  const lines = breakLines(widths, space, max);
  const widest = Math.max(...lines.map((ix) => ix.reduce((n, i) => n + widths[i], 0) + space * (ix.length - 1)));
  if (widest > max) {
    // A word too long for the frame shrinks the caption rather than spilling off it.
    px *= max / widest;
    setFont(ctx, look, px);
    widths = texts.map((s) => ctx.measureText(s).width);
    space = ctx.measureText(" ").width;
  }
  const lh = px * 1.18;

  // How the caption comes in and goes out.
  const tIn = t - g.start;
  const tOut = g.end - t;
  let alpha = 1;
  let scale = 1;
  let dx = 0;
  let dy = 0;
  switch (cap.animation) {
    case "pop":
      scale = 0.55 + 0.45 * easeOutBack(tIn / 0.22);
      alpha = clamp01(tIn / 0.06);
      break;
    case "rise":
      dy = (1 - easeOutCubic(tIn / 0.22)) * 60 * u;
      alpha = clamp01(tIn / 0.18);
      break;
    case "slide":
      dx = (1 - easeOutCubic(tIn / 0.22)) * -90 * u;
      alpha = clamp01(tIn / 0.18);
      break;
    case "fade":
      alpha = clamp01(tIn / 0.2);
      break;
    case "zoom":
      scale = 1.3 - 0.3 * easeOutCubic(tIn / 0.25);
      alpha = clamp01(tIn / 0.1);
      break;
  }
  if (g.gapAfter && cap.animation !== "none") {
    const o = clamp01(tOut / 0.12);
    alpha *= o;
    if (cap.animation === "pop" || cap.animation === "zoom") scale *= 0.85 + 0.15 * o;
  }
  if (alpha <= 0.001) return;

  const cy = cap.y * H + dy;
  const blockH = lines.length * lh;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2 + dx, cy);
  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // Words not yet said stay hidden in the bounce and typewriter styles, without moving the rest.
  const shown = (w: CapWord) => (cap.animation === "bounce" || cap.animation === "typewriter" ? t >= w.start - 0.02 : true);

  lines.forEach((ix, li) => {
    const lineW = ix.reduce((n, i) => n + widths[i], 0) + space * (ix.length - 1);
    const y = -blockH / 2 + lh * li + lh / 2;
    let x = -lineW / 2;
    if (look.box.on) {
      const padX = look.box.padX * u;
      const padY = look.box.padY * u;
      drawBox(ctx, x - padX, y - px / 2 - padY, lineW + padX * 2, px + padY * 2, look, u);
    }
    for (const i of ix) {
      const w = g.words[i];
      const active = i === now.word && cap.highlight.on;
      if (shown(w)) {
        let s = active ? cap.highlight.scale : 1;
        if (cap.animation === "bounce") s *= 0.5 + 0.5 * easeOutBack((t - w.start) / 0.18);
        const cx = x + widths[i] / 2;
        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(s, s);
        if (active && cap.highlight.mode === "box") {
          const pad = px * 0.14;
          setShadow(ctx, null, u);
          roundRect(ctx, -widths[i] / 2 - pad, -px * 0.62, widths[i] + pad * 2, px * 1.24, px * 0.18);
          ctx.fillStyle = cap.highlight.boxColor;
          ctx.fill();
        }
        const fill = active ? cap.highlight.color : look.color;
        drawText(ctx, texts[i], -widths[i] / 2, 0, look, fill, u, !look.box.on, s);
        ctx.restore();
      }
      x += widths[i] + space;
    }
  });
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** The hook text, styled like any CapCut text: font, colours, outline, shadow and a box behind it. */
function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, edit: Edit, t: number) {
  const o = edit.overlay;
  const raw = o.text.trim();
  if (!raw || (o.until > 0 && t >= o.until)) return;
  const look = o.style;
  const u = unit(W, H);
  const px = look.size * u;
  const text = look.upper ? raw.toUpperCase() : raw;
  ctx.save();
  setFont(ctx, look, px);
  const lines = wrap(ctx, text, W * o.width);
  const lh = px * 1.25;
  const padX = look.box.padX * u;
  const padY = look.box.padY * u;
  const lineW = lines.map((l) => ctx.measureText(l).width);
  const boxW = Math.max(...lineW) + padX * 2;
  const boxH = lines.length * lh + padY * 2;

  let alpha = 1;
  let scale = 1;
  let dx = 0;
  let dy = 0;
  switch (o.animation) {
    case "pop":
      scale = 0.55 + 0.45 * easeOutBack(t / 0.3);
      alpha = clamp01(t / 0.08);
      break;
    case "rise":
      dy = (1 - easeOutCubic(t / 0.35)) * 80 * u;
      alpha = clamp01(t / 0.3);
      break;
    case "slide":
      dx = (1 - easeOutCubic(t / 0.35)) * -W * 0.3;
      alpha = clamp01(t / 0.3);
      break;
    case "fade":
      alpha = clamp01(t / 0.35);
      break;
  }
  if (o.until > 0 && o.animation !== "none") alpha *= clamp01((o.until - t) / 0.2);
  if (alpha <= 0.001) {
    ctx.restore();
    return;
  }
  // Typewriter: letters appear 30 a second.
  let budget = o.animation === "typewriter" ? Math.floor(t * 30) : Infinity;

  ctx.globalAlpha = alpha;
  ctx.translate(W / 2 + dx, o.y * H + dy);
  ctx.scale(scale, scale);
  if (look.box.on) drawBox(ctx, -boxW / 2, -boxH / 2, boxW, boxH, look, u);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => {
    if (budget <= 0) return;
    const part = l.slice(0, budget);
    budget -= l.length;
    const y = -boxH / 2 + padY + lh * i + lh / 2;
    if (part.length < l.length) {
      // Keep the visible letters where they'll sit once the line is complete.
      ctx.textAlign = "left";
      drawText(ctx, part, -lineW[i] / 2, y, look, look.color, u, !look.box.on);
      ctx.textAlign = "center";
    } else drawText(ctx, l, 0, y, look, look.color, u, !look.box.on);
  });
  ctx.restore();
}

/**
 * Draws the edit at time `t`. `pic` is the clip's frame at that moment, or
 * null while it loads (or if its footage is missing), which draws a plain
 * frame with the captions and text still on it. `source` is the moment in the
 * clip's video, which places any punch-in zoom.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  edit: Edit,
  clip: EditClip | undefined,
  pic: Picture | null,
  groups: CapGroup[],
  t: number,
  source?: number,
) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (clip && pic && pic.width && pic.height) drawPicture(ctx, W, H, pic, clip, source == null ? 1 : zoomAt(clip, source));
  ctx.restore();
  drawCaption(ctx, W, H, edit, groups, t);
  drawOverlay(ctx, W, H, edit, t);
}
