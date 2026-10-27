"use client";

// Draws one frame of an edit. The preview and the export both call this, so
// what plays in the Studio is exactly what gets exported.
//
// Sizes follow LeadLab Studio's burned captions (lead-lab-ai studio/captions.py,
// the "bold" look): 108px Montserrat ExtraBold on a 1080-wide frame, white
// capitals, a 7px black outline, a 3px drop shadow, the spoken word in colour.
// Everything scales with the frame, so a small preview canvas looks the same.
import { captionAt, type CapGroup } from "./captions";
import type { Edit, EditClip } from "./types";

export interface Picture {
  image: CanvasImageSource;
  width: number;
  height: number;
}

const FALLBACK_CAPTION = "'Arial Black', Arial, sans-serif";
const FALLBACK_SANS = "system-ui, sans-serif";

function cssVar(name: string) {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The caption and overlay fonts, as loaded by the app (app/layout.tsx). */
export function fonts() {
  return {
    caption: cssVar("--font-caption") || FALLBACK_CAPTION,
    sans: cssVar("--font-geist-sans") || FALLBACK_SANS,
  };
}

/** Waits for the fonts, so the first frames aren't drawn in a fallback face. */
export async function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  const f = fonts();
  await Promise.all([document.fonts.load(`800 108px ${f.caption}`), document.fonts.load(`700 56px ${f.sans}`)]).catch(() => {});
}

/** One unit = one pixel on a 1080-wide (or 1080-tall) frame. */
const unit = (W: number, H: number) => Math.min(W, H) / 1080;

/** Where a clip's picture lands: cover or contain, zoomed, with its subject kept in view. */
export function placement(W: number, H: number, sw: number, sh: number, clip: Pick<EditClip, "fit" | "focus" | "zoom">, cover: boolean) {
  const scale = (cover ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh)) * Math.max(1, clip.zoom);
  const dw = sw * scale;
  const dh = sh * scale;
  // Centre on the subject, then keep the picture covering the frame where it can.
  const place = (frame: number, size: number, focus: number) => {
    if (size <= frame) return (frame - size) / 2;
    return Math.min(0, Math.max(frame - size, frame / 2 - focus * size));
  };
  return { x: place(W, dw, clip.focus.x), y: place(H, dh, clip.focus.y), w: dw, h: dh };
}

function drawPicture(ctx: CanvasRenderingContext2D, W: number, H: number, pic: Picture, clip: EditClip) {
  if (clip.fit === "fit") {
    // The whole picture, over a darkened, blurred copy of itself filling the frame.
    const bg = placement(W, H, pic.width, pic.height, { fit: "fill", focus: clip.focus, zoom: 1.08 }, true);
    ctx.save();
    ctx.filter = `blur(${Math.round(unit(W, H) * 36)}px) brightness(0.55)`;
    ctx.drawImage(pic.image, bg.x, bg.y, bg.w, bg.h);
    ctx.restore();
    const fg = placement(W, H, pic.width, pic.height, clip, false);
    ctx.drawImage(pic.image, fg.x, fg.y, fg.w, fg.h);
    return;
  }
  const p = placement(W, H, pic.width, pic.height, clip, true);
  ctx.drawImage(pic.image, p.x, p.y, p.w, p.h);
}

function drawCaption(ctx: CanvasRenderingContext2D, W: number, H: number, edit: Edit, groups: CapGroup[], t: number) {
  const now = captionAt(groups, t);
  if (!now) return;
  const u = unit(W, H) * edit.captions.size;
  const bold = edit.captions.look === "bold";
  const words = now.group.words.map((w) => w.text.toUpperCase());
  let size = 108 * u;
  const family = fonts().caption;
  ctx.save();
  ctx.font = `800 ${size}px ${family}`;
  const space = () => ctx.measureText(" ").width;
  const lineWidth = () => words.reduce((n, w) => n + ctx.measureText(w).width, 0) + space() * (words.length - 1);
  // A word too long for the frame shrinks the line rather than wrapping it.
  const room = W * 0.9;
  if (lineWidth() > room) {
    size *= room / lineWidth();
    ctx.font = `800 ${size}px ${family}`;
  }
  const scale = size / 108;
  let x = (W - lineWidth()) / 2;
  const y = edit.captions.y * H;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  words.forEach((w, i) => {
    const width = ctx.measureText(w).width;
    if (bold) {
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowOffsetY = 3 * scale;
      ctx.shadowOffsetX = 3 * scale;
      ctx.lineWidth = 14 * scale; // a 7px outline each side of the stroke
      ctx.strokeStyle = "#000";
      ctx.strokeText(w, x, y);
      ctx.shadowColor = "transparent";
      ctx.fillStyle = i === now.word ? edit.captions.highlight : "#fff";
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 18 * scale;
      ctx.fillStyle = "#fff";
    }
    ctx.fillText(w, x, y);
    x += width + space();
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The hook text: black on a white box, the way Instagram's own text tool draws it. */
function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, edit: Edit, t: number) {
  const { text, until, position } = edit.overlay;
  if (!text.trim() || (until > 0 && t >= until)) return;
  const u = unit(W, H);
  const size = 54 * u;
  ctx.save();
  ctx.font = `700 ${size}px ${fonts().sans}`;
  const lines = wrap(ctx, text.trim(), W * 0.78);
  const lh = size * 1.25;
  const padX = 28 * u;
  const padY = 20 * u;
  const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
  const boxH = lines.length * lh + padY * 2;
  // Clear of the app's own buttons at the top of a vertical video.
  const top = position === "top" ? H * (H > W ? 0.14 : 0.08) : H * 0.4 - boxH / 2;
  const left = (W - boxW) / 2;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24 * u;
  ctx.fillStyle = "#fff";
  roundRect(ctx, left, top, boxW, boxH, 16 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + padY + lh * i + lh / 2));
  ctx.restore();
}

/**
 * Draws the edit at time `t`. `pic` is the clip's frame at that moment, or
 * null while it loads (or if its footage is missing), which draws a plain
 * frame with the captions and text still on it.
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
) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (clip && pic && pic.width && pic.height) drawPicture(ctx, W, H, pic, clip);
  ctx.restore();
  drawCaption(ctx, W, H, edit, groups, t);
  drawOverlay(ctx, W, H, edit, t);
}
