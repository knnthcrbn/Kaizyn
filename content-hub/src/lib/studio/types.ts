// Studio edits: an ordered list of clips cut from the footage library, with
// the framing, captions, hook text and music to put on them. An edit is a
// small record (no video in it) shared with the team through hub sync, like a
// card; the video is only ever made in a browser at export time.

export type Aspect = "9:16" | "4:5" | "1:1" | "16:9";

export const ASPECTS: { id: Aspect; label: string; hint: string; w: number; h: number }[] = [
  { id: "9:16", label: "9:16", hint: "Reels, TikTok, Shorts", w: 1080, h: 1920 },
  { id: "4:5", label: "4:5", hint: "Instagram feed", w: 1080, h: 1350 },
  { id: "1:1", label: "1:1", hint: "Square", w: 1080, h: 1080 },
  { id: "16:9", label: "16:9", hint: "YouTube", w: 1920, h: 1080 },
];

export const aspectSize = (a: Aspect) => ASPECTS.find((x) => x.id === a) ?? ASPECTS[0];

/** A stretch taken out of a clip, in seconds of its source (a pause, or a slice cut on the waveform). */
export interface Cut {
  from: number;
  to: number;
  /** Made by "Remove dead space", so running it again replaces it. */
  auto?: boolean;
}

/** A punch-in on the picture, in seconds of the clip's source. */
export interface Zoom {
  from: number;
  to: number;
  /** 1.15 = 15% closer. */
  scale: number;
  /** Picked by Claude, so running AI zoom again replaces it. */
  auto?: boolean;
}

/** A word heard by auto captions, in seconds of the clip's source. */
export interface SrcWord {
  text: string;
  start: number;
  end: number;
}

export interface EditClip {
  /** This clip's own id, so the same footage can appear twice. */
  id: string;
  footageId: string;
  /** Seconds into the source video. */
  in: number;
  out: number;
  /** Fill crops to the frame; fit shows the whole picture over a blurred copy of itself. */
  fit: "fill" | "fit";
  /**
   * Where the subject sits in the source, 0..1 on each axis. A crop keeps that
   * point in view, so one setting works for every export shape.
   */
  focus: { x: number; y: number };
  /** 1 = no zoom. */
  zoom: number;
  muted?: boolean;
  cuts?: Cut[];
  zooms?: Zoom[];
  /** Auto captions: every word with its own timing. */
  words?: SrcWord[];
  /** The stretch of source the words cover; trimming outside it needs captions run again. */
  wordsSpan?: [number, number];
}

export interface Stroke {
  on: boolean;
  color: string;
  /** Pixels on a 1080 frame. */
  width: number;
}

export interface Shadow {
  on: boolean;
  color: string;
  opacity: number;
  /** Pixels on a 1080 frame. */
  blur: number;
  distance: number;
  /** Degrees, 90 = straight down. */
  angle: number;
}

export interface Box {
  on: boolean;
  color: string;
  opacity: number;
  radius: number;
  padX: number;
  padY: number;
  border: Stroke;
}

/** How a piece of text looks: the controls CapCut gives you for any text. */
export interface TextLook {
  font: string;
  /** Pixels on a 1080 frame. */
  size: number;
  italic: boolean;
  upper: boolean;
  /** Extra space between letters, as a share of the size. */
  spacing: number;
  color: string;
  stroke: Stroke;
  shadow: Shadow;
  box: Box;
}

export type CaptionAnim = "none" | "pop" | "bounce" | "rise" | "slide" | "fade" | "typewriter" | "zoom";
export type TextAnim = "none" | "pop" | "rise" | "slide" | "fade" | "typewriter";

export interface EditCaptions {
  on: boolean;
  style: TextLook;
  /** The word being said. */
  highlight: {
    on: boolean;
    /** "color": the word changes colour; "box": a block of colour sits behind it. */
    mode: "color" | "box";
    color: string;
    boxColor: string;
    /** 1 = same size; 1.15 = the word grows while it's said. */
    scale: number;
  };
  /** Most words on screen at once. */
  words: number;
  /** Centre of the caption line, as a share of the frame's height. */
  y: number;
  animation: CaptionAnim;
}

export interface EditOverlay {
  /** The hook text on screen; empty for none. */
  text: string;
  /** Seconds it stays up; 0 = the whole video. */
  until: number;
  style: TextLook;
  /** Centre of the text, as a share of the frame's height. */
  y: number;
  /** Longest line, as a share of the frame's width. */
  width: number;
  animation: TextAnim;
}

export interface EditMusic {
  path: string;
  name: string;
  /** Length of the file, in seconds. */
  duration: number;
  /** 0..1 */
  volume: number;
  /** Where in the song the video starts, in seconds. */
  start: number;
  fadeIn: boolean;
  fadeOut: boolean;
}

export interface Edit {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  aspect: Aspect;
  clips: EditClip[];
  captions: EditCaptions;
  /**
   * Fixes to the captions' wording, per clip and line: key
   * `${clip.id}:${line}`. An empty string hides that line.
   */
  captionText: Record<string, string>;
  overlay: EditOverlay;
  music?: EditMusic;
  /** Volume of the clips' own sound, 0..2. */
  sourceVolume?: number;
  /** The pipeline card this video is for, if any. */
  cardId?: string;
}

// LeadLab's caption colours (lead-lab-ai studio/captions.py): yellow, blue, green.
export const HIGHLIGHTS = ["#FFE14D", "#3FA9FF", "#3DFF6E"];

const noStroke = (): Stroke => ({ on: false, color: "#000000", width: 6 });
const noBox = (): Box => ({ on: false, color: "#000000", opacity: 0.7, radius: 14, padX: 24, padY: 12, border: noStroke() });

/** LeadLab Studio's bold captions: white capitals, 7px black outline, 3px drop shadow, the spoken word in yellow. */
export const leadlabCaptions = (): EditCaptions => ({
  on: true,
  style: {
    font: "montserrat",
    size: 108,
    italic: false,
    upper: true,
    spacing: 0,
    color: "#FFFFFF",
    stroke: { on: true, color: "#000000", width: 7 },
    shadow: { on: true, color: "#000000", opacity: 0.5, blur: 0, distance: 4.2, angle: 45 },
    box: noBox(),
  },
  highlight: { on: true, mode: "color", color: HIGHLIGHTS[0], boxColor: "#7C3AED", scale: 1 },
  words: 3,
  y: 0.59,
  animation: "none",
});

/** Captions for a YouTube video: smaller, lower, a sentence's worth at a time. */
export const youtubeCaptions = (): EditCaptions => ({
  ...leadlabCaptions(),
  style: {
    ...leadlabCaptions().style,
    font: "poppins",
    size: 58,
    upper: false,
    stroke: { on: true, color: "#000000", width: 5 },
    shadow: { on: true, color: "#000000", opacity: 0.6, blur: 10, distance: 3, angle: 90 },
  },
  highlight: { on: true, mode: "color", color: "#FFE14D", boxColor: "#7C3AED", scale: 1 },
  words: 7,
  y: 0.86,
});

/** The hook text: black on a white box, the way Instagram's own text tool draws it. */
export const defaultOverlay = (): EditOverlay => ({
  text: "",
  until: 0,
  style: {
    font: "geist",
    size: 54,
    italic: false,
    upper: false,
    spacing: 0,
    color: "#000000",
    stroke: noStroke(),
    shadow: { on: true, color: "#000000", opacity: 0.35, blur: 24, distance: 0, angle: 90 },
    box: { on: true, color: "#FFFFFF", opacity: 1, radius: 16, padX: 28, padY: 20, border: noStroke() },
  },
  y: 0.18,
  width: 0.78,
  animation: "none",
});

type LegacyCaptions = Omit<Partial<EditCaptions>, "highlight"> & {
  look?: "bold" | "white" | "off";
  highlight?: unknown;
  size?: number;
};
type LegacyOverlay = Partial<EditOverlay> & { position?: "top" | "middle" };

/**
 * An edit with every setting present. Edits saved before a setting existed
 * (the first Studio, 27 Oct) are read through this, so nothing reads undefined.
 */
export function withDefaults(raw: Edit): Edit {
  const c = (raw.captions ?? {}) as LegacyCaptions;
  let captions: EditCaptions;
  if (c.style) captions = { ...leadlabCaptions(), ...(c as EditCaptions) };
  else {
    // The first Studio's captions: { look, highlight: colour, y, size: multiplier }.
    captions = leadlabCaptions();
    if (typeof c.y === "number") captions.y = c.y;
    if (typeof c.size === "number") captions.style.size = Math.round(108 * c.size);
    if (typeof c.highlight === "string") captions.highlight.color = c.highlight;
    if (c.look === "off") captions.on = false;
    if (c.look === "white") {
      captions.style.stroke.on = false;
      captions.style.shadow = { on: true, color: "#000000", opacity: 0.55, blur: 18, distance: 0, angle: 90 };
      captions.highlight.on = false;
    }
  }
  const o = (raw.overlay ?? {}) as LegacyOverlay;
  const overlay: EditOverlay = o.style
    ? { ...defaultOverlay(), ...(o as EditOverlay) }
    : { ...defaultOverlay(), text: o.text ?? "", until: o.until ?? 0, y: o.position === "middle" ? 0.42 : 0.18 };
  return { ...raw, captions, overlay, captionText: raw.captionText ?? {}, clips: raw.clips ?? [] };
}

export const newClip = (footageId: string, from: number, to: number, id: string): EditClip => ({
  id,
  footageId,
  in: Math.max(0, from),
  out: Math.max(from + 0.5, to),
  fit: "fill",
  focus: { x: 0.5, y: 0.5 },
  zoom: 1,
});

export const clipLength = (c: EditClip) => Math.max(0, c.out - c.in);

/** A piece of a clip that plays: the clip minus its cuts. */
export interface Segment {
  clip: EditClip;
  /** Which clip, in the edit's order. */
  index: number;
  in: number;
  out: number;
  /** Where it starts on the edit's timeline. */
  start: number;
}

const MIN_PIECE = 0.04;

/** The parts of a clip its cuts leave, in source seconds. */
export function keptRanges(c: EditClip): [number, number][] {
  const cuts = (c.cuts ?? [])
    .map((x) => [Math.max(c.in, x.from), Math.min(c.out, x.to)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let at = c.in;
  for (const [a, b] of cuts) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (c.out > at) out.push([at, c.out]);
  return out.filter(([a, b]) => b - a >= MIN_PIECE);
}

/** Everything that plays, in order, on the edit's timeline. */
export function segments(e: Pick<Edit, "clips">): Segment[] {
  const out: Segment[] = [];
  let t = 0;
  e.clips.forEach((clip, index) => {
    for (const [a, b] of keptRanges(clip)) {
      out.push({ clip, index, in: a, out: b, start: t });
      t += b - a;
    }
  });
  return out;
}

export const segLength = (s: Pick<Segment, "in" | "out">) => s.out - s.in;

export const editLength = (e: Pick<Edit, "clips">) => segments(e).reduce((n, s) => n + segLength(s), 0);

/** How long a clip plays once its cuts are taken out. */
export const keptLength = (c: EditClip) => keptRanges(c).reduce((n, [a, b]) => n + b - a, 0);

/** Where each clip starts on the edit's timeline. */
export function clipStarts(e: Pick<Edit, "clips">) {
  const out: number[] = [];
  let t = 0;
  for (const c of e.clips) {
    out.push(t);
    t += keptLength(c);
  }
  return out;
}

/** What's playing at edit time `t`: the piece, its clip, and the moment in the source. */
export function locate(e: Pick<Edit, "clips">, t: number) {
  const segs = segments(e);
  if (!segs.length) return null;
  let i = segs.findIndex((s) => t < s.start + segLength(s));
  if (i < 0) i = segs.length - 1;
  const s = segs[i];
  const local = Math.min(Math.max(0, t - s.start), segLength(s));
  return { seg: s, segIndex: i, segs, clip: s.clip, index: s.index, start: s.start, source: s.in + local };
}

/** The edit time a moment of a clip's source plays at, or null if it was cut. */
export function toEditTime(segs: Segment[], clipId: string, source: number) {
  for (const s of segs) if (s.clip.id === clipId && source >= s.in && source <= s.out) return s.start + (source - s.in);
  return null;
}

/** The source moment (and clip) under edit time `t`. */
export function toSource(segs: Segment[], t: number) {
  const s = segs.find((x) => t >= x.start && t <= x.start + segLength(x));
  return s ? { clip: s.clip, source: s.in + (t - s.start) } : null;
}

/** Folds overlapping or touching ranges together. */
export function mergeRanges<T extends { from: number; to: number }>(list: T[]): T[] {
  const sorted = [...list].sort((a, b) => a.from - b.from);
  const out: T[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to + 1e-3) out[out.length - 1] = { ...last, to: Math.max(last.to, r.to), auto: (last as Cut).auto && (r as Cut).auto };
    else out.push({ ...r });
  }
  return out;
}

/** How far in the picture is pushed at a source moment: 1 = not at all. Eases in and out like a punch-in. */
export function zoomAt(c: EditClip, source: number) {
  const EASE_IN = 0.18;
  const EASE_OUT = 0.3;
  let z = 1;
  for (const zm of c.zooms ?? []) {
    if (source < zm.from - 0.001 || source > zm.to + EASE_OUT) continue;
    let k: number;
    if (source < zm.from + EASE_IN) k = smooth((source - zm.from) / EASE_IN);
    else if (source <= zm.to) k = 1;
    else k = 1 - smooth((source - zm.to) / EASE_OUT);
    z = Math.max(z, 1 + (zm.scale - 1) * k);
  }
  return z;
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
