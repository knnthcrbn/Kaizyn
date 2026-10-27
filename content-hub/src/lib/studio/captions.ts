// Captions for an edit, grouped the way LeadLab Studio burns them
// (lead-lab-ai studio/captions.py): a few words at a time, a new caption at
// sentence punctuation or a pause, never more letters than fit on one line.
//
// Words come from auto captions when a clip has them (each word timed by the
// speech model, like CapCut), else from the footage library's transcript,
// which times phrases: each phrase's words are spread over it by length, as
// LeadLab does when it has no word times.
import type { Footage } from "../footage/types";
import { fontWidth } from "./fonts";
import { aspectSize, segments, type Edit, type EditClip, type Segment, type SrcWord } from "./types";

export interface CapWord {
  text: string;
  start: number;
  end: number;
}

export interface CapGroup {
  start: number;
  end: number;
  words: CapWord[];
  /** Nothing follows straight on, so the caption can animate out. */
  gapAfter: boolean;
}

/** A line of captions as it appears in this edit, for the caption editor. */
export interface EditLine {
  key: string;
  clipId: string;
  /** On the edit's timeline. */
  start: number;
  end: number;
  text: string;
  original: string;
  hidden: boolean;
  /** Timed word by word (auto captions), not spread across a phrase. */
  timed: boolean;
}

/** A line of a clip's words before cuts, in source seconds. */
interface SourceLine {
  key: string;
  start: number;
  end: number;
  words: SrcWord[];
  text: string;
  timed: boolean;
}

const PAUSE = 0.4; // a gap this long starts a new caption
const HOLD = 0.25; // keep a caption up this long after its last word, unless the next starts sooner
const LINE_PAUSE = 0.7; // auto captions: a gap this long starts a new line in the editor

export const lineKey = (clipId: string, index: number | string) => `${clipId}:${index}`;

/** A phrase's words, timed across it by length (longer words take longer to say). */
export function spreadWords(text: string, start: number, end: number): SrcWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length || end <= start) return [];
  const weight = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1);
  const total = weight.reduce((a, b) => a + b, 0);
  const out: SrcWord[] = [];
  let t = start;
  words.forEach((w, i) => {
    const d = ((end - start) * weight[i]) / total;
    out.push({ text: w, start: t, end: t + d });
    t += d;
  });
  return out;
}

/** A clip's lines: its auto-caption words split into sentences, else the library transcript's lines. */
function sourceLines(clip: EditClip, item: Footage | undefined): SourceLine[] {
  if (clip.words?.length) {
    const lines: SourceLine[] = [];
    let cur: SrcWord[] = [];
    const flush = () => {
      if (!cur.length) return;
      lines.push({
        key: `a${lines.length}`,
        start: cur[0].start,
        end: cur[cur.length - 1].end,
        words: cur,
        text: cur.map((w) => w.text).join(" "),
        timed: true,
      });
      cur = [];
    };
    for (const w of clip.words) {
      if (cur.length && (w.start - cur[cur.length - 1].end > LINE_PAUSE || cur.length >= 14)) flush();
      cur.push(w);
      if (/[.!?]$/.test(w.text)) flush();
    }
    flush();
    return lines;
  }
  return (item?.transcript ?? []).map((l, i) => ({
    key: String(i),
    start: l.start,
    end: l.end,
    words: spreadWords(l.text.trim(), l.start, l.end),
    text: l.text.trim(),
    timed: false,
  }));
}

/** The words a line says once its wording is fixed: same timings when the count matches, else spread. */
function fixedWords(line: SourceLine, fixed: string | undefined): SrcWord[] {
  if (fixed == null || fixed === line.text) return line.words;
  const next = fixed.split(/\s+/).filter(Boolean);
  if (next.length === line.words.length) return line.words.map((w, i) => ({ ...w, text: next[i] }));
  return spreadWords(fixed, line.start, line.end);
}

/** Moves source-timed words onto the edit's clock; words said in a cut are dropped. */
function placeWords(words: SrcWord[], segs: Segment[]): CapWord[] {
  const out: CapWord[] = [];
  for (const w of words) {
    const mid = (w.start + w.end) / 2;
    const s = segs.find((x) => mid >= x.in && mid < x.out);
    if (!s) continue;
    out.push({
      text: w.text,
      start: s.start + Math.max(0, w.start - s.in),
      end: s.start + Math.min(s.out - s.in, w.end - s.in),
    });
  }
  return out;
}

/** The caption lines each clip uses, placed on the edit's timeline. */
export function editLines(edit: Edit, items: Record<string, Footage | undefined>): EditLine[] {
  const segs = segments(edit);
  const out: EditLine[] = [];
  for (const clip of edit.clips) {
    const mine = segs.filter((s) => s.clip.id === clip.id);
    for (const line of sourceLines(clip, items[clip.footageId])) {
      if (line.end <= clip.in || line.start >= clip.out) continue;
      const key = lineKey(clip.id, line.key);
      const fixed = edit.captionText[key];
      const placed = placeWords(line.words, mine);
      if (!placed.length) continue; // entirely cut
      out.push({
        key,
        clipId: clip.id,
        start: placed[0].start,
        end: placed[placed.length - 1].end,
        text: fixed ?? line.text,
        original: line.text,
        hidden: fixed === "",
        timed: line.timed,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Every caption in the edit, in order, on the edit's timeline. */
export function buildCaptions(edit: Edit, items: Record<string, Footage | undefined>): CapGroup[] {
  if (!edit.captions.on) return [];
  const segs = segments(edit);
  const { w: W, h: H } = aspectSize(edit.aspect);
  const style = edit.captions.style;
  // How many letters fit across 90% of the frame at this size in this font
  // (LeadLab: 11 Montserrat capitals at 108px on a 1080 frame).
  const room = (0.9 * W) / (Math.min(W, H) / 1080);
  const perChar = (style.size / 108) * (972 / 11) * fontWidth(style.font) * (style.upper ? 1 : 0.8) * (1 + style.spacing);
  const maxChars = Math.max(4, Math.floor(room / perChar));
  const most = Math.max(1, edit.captions.words);

  const groups: CapGroup[] = [];
  for (const clip of edit.clips) {
    const mine = segs.filter((s) => s.clip.id === clip.id);
    for (const line of sourceLines(clip, items[clip.footageId])) {
      if (line.end <= clip.in || line.start >= clip.out) continue;
      const fixed = edit.captionText[lineKey(clip.id, line.key)];
      if (fixed === "") continue;
      const words = placeWords(fixedWords(line, fixed), mine);
      let cur: CapWord[] = [];
      const flush = () => {
        if (cur.length) groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur, gapAfter: true });
        cur = [];
      };
      for (const w of words) {
        const chars = [...cur, w].map((x) => x.text).join(" ").length;
        const pause = cur.length > 0 && w.start - cur[cur.length - 1].end > PAUSE;
        if (cur.length && (cur.length >= most || chars > maxChars || pause)) flush();
        cur.push(w);
        if (/[.!?,;:]$/.test(w.text)) flush();
      }
      flush();
    }
  }
  groups.sort((a, b) => a.start - b.start);
  // Hold each caption a beat, but never over the next one.
  for (let i = 0; i < groups.length; i++) {
    const next = groups[i + 1]?.start ?? Infinity;
    const held = groups[i].end + HOLD;
    groups[i].end = Math.min(next, held);
    groups[i].gapAfter = next > held + 0.01;
  }
  return groups;
}

/** The caption on screen at time `t`, and which of its words is being said. */
export function captionAt(groups: CapGroup[], t: number) {
  let lo = 0;
  let hi = groups.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const g = groups[mid];
    if (t < g.start) hi = mid - 1;
    else if (t >= g.end) lo = mid + 1;
    else {
      let word = g.words.findIndex((w) => t < w.end);
      if (word < 0) word = g.words.length - 1;
      return { group: g, word };
    }
  }
  return null;
}
