// Studio edits: an ordered list of clips cut from the footage library, with
// the framing, captions and hook text to burn in. An edit is a small record
// (no video in it) shared with the team through hub sync, like a card; the
// video is only ever made in a browser at export time.

export type Aspect = "9:16" | "4:5" | "1:1" | "16:9";

export const ASPECTS: { id: Aspect; label: string; hint: string; w: number; h: number }[] = [
  { id: "9:16", label: "9:16", hint: "Reels, TikTok, Shorts", w: 1080, h: 1920 },
  { id: "4:5", label: "4:5", hint: "Instagram feed", w: 1080, h: 1350 },
  { id: "1:1", label: "1:1", hint: "Square", w: 1080, h: 1080 },
  { id: "16:9", label: "16:9", hint: "YouTube", w: 1920, h: 1080 },
];

export const aspectSize = (a: Aspect) => ASPECTS.find((x) => x.id === a) ?? ASPECTS[0];

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
}

export type CaptionLook = "bold" | "white" | "off";

export interface EditCaptions {
  /** "bold": LeadLab's look (white capitals, black outline, the spoken word in colour). */
  look: CaptionLook;
  /** The spoken word's colour in the bold look. */
  highlight: string;
  /** Centre of the caption line, as a share of the frame's height. */
  y: number;
  /** 1 = LeadLab's size (108px on a 1080-wide frame). */
  size: number;
}

export interface EditOverlay {
  /** The hook text on screen; empty for none. */
  text: string;
  /** Seconds it stays up; 0 = the whole video. */
  until: number;
  position: "top" | "middle";
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
   * Fixes to the transcript's wording, per clip and line: key
   * `${clip.id}:${line index}`. An empty string hides that line.
   */
  captionText: Record<string, string>;
  overlay: EditOverlay;
  /** The pipeline card this video is for, if any. */
  cardId?: string;
}

// LeadLab's caption colours (lead-lab-ai studio/captions.py): yellow, blue, green.
export const HIGHLIGHTS = ["#FFE14D", "#3FA9FF", "#3DFF6E"];

export const DEFAULT_CAPTIONS: EditCaptions = { look: "bold", highlight: HIGHLIGHTS[0], y: 0.59, size: 1 };

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
export const editLength = (e: Pick<Edit, "clips">) => e.clips.reduce((n, c) => n + clipLength(c), 0);

/** Where each clip starts on the edit's timeline. */
export function clipStarts(e: Pick<Edit, "clips">) {
  const out: number[] = [];
  let t = 0;
  for (const c of e.clips) {
    out.push(t);
    t += clipLength(c);
  }
  return out;
}

/** The clip playing at edit time `t`, and the matching moment in its source. */
export function locate(e: Pick<Edit, "clips">, t: number) {
  const starts = clipStarts(e);
  for (let i = 0; i < e.clips.length; i++) {
    const c = e.clips[i];
    if (t < starts[i] + clipLength(c) || i === e.clips.length - 1) {
      const local = Math.min(Math.max(0, t - starts[i]), clipLength(c));
      return { index: i, clip: c, start: starts[i], source: c.in + local };
    }
  }
  return null;
}
