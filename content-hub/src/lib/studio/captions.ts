// Captions for an edit, from the footage library's transcripts, grouped the way
// LeadLab Studio burns them (lead-lab-ai studio/captions.py): a few words at a
// time, a new caption at sentence punctuation or a pause, never more letters
// than fit on one line.
//
// The transcripts carry times per phrase, not per word, so each phrase's words
// are spread over it by length. LeadLab does the same when it has no word
// times; phrases are short, so the spoken word stays close to the highlight.
import type { Footage, FootageLine } from "../footage/types";
import { clipLength, clipStarts, type Edit } from "./types";

export interface CapWord {
  text: string;
  start: number;
  end: number;
}

export interface CapGroup {
  start: number;
  end: number;
  words: CapWord[];
}

/** A transcript line as it appears in this edit, for the caption editor. */
export interface EditLine {
  key: string;
  clipId: string;
  /** On the edit's timeline. */
  start: number;
  end: number;
  text: string;
  original: string;
  hidden: boolean;
}

const MOST_WORDS = 3;
const MOST_CHARS = 11; // capitals; LeadLab's limit so the line never wraps
const PAUSE = 0.4; // a gap this long starts a new caption
const HOLD = 0.25; // keep a caption up this long after its last word, unless the next starts sooner

export const lineKey = (clipId: string, index: number) => `${clipId}:${index}`;

/** The transcript lines each clip uses, placed on the edit's timeline. */
export function editLines(edit: Edit, items: Record<string, Footage | undefined>): EditLine[] {
  const starts = clipStarts(edit);
  const out: EditLine[] = [];
  edit.clips.forEach((clip, ci) => {
    const lines: FootageLine[] = items[clip.footageId]?.transcript ?? [];
    lines.forEach((line, li) => {
      if (line.end <= clip.in || line.start >= clip.out) return;
      const key = lineKey(clip.id, li);
      const fixed = edit.captionText[key];
      out.push({
        key,
        clipId: clip.id,
        start: starts[ci] + Math.max(0, line.start - clip.in),
        end: starts[ci] + Math.min(clipLength(clip), line.end - clip.in),
        text: fixed ?? line.text.trim(),
        original: line.text.trim(),
        hidden: fixed === "",
      });
    });
  });
  return out;
}

/** A phrase's words, timed across it by length (longer words take longer to say). */
export function spreadWords(text: string, start: number, end: number): CapWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length || end <= start) return [];
  const weight = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1);
  const total = weight.reduce((a, b) => a + b, 0);
  const out: CapWord[] = [];
  let t = start;
  words.forEach((w, i) => {
    const d = ((end - start) * weight[i]) / total;
    out.push({ text: w, start: t, end: t + d });
    t += d;
  });
  return out;
}

/** Every caption in the edit, in order, on the edit's timeline. */
export function buildCaptions(edit: Edit, items: Record<string, Footage | undefined>): CapGroup[] {
  if (edit.captions.look === "off") return [];
  const starts = clipStarts(edit);
  const groups: CapGroup[] = [];
  edit.clips.forEach((clip, ci) => {
    const lines = items[clip.footageId]?.transcript ?? [];
    lines.forEach((line, li) => {
      if (line.end <= clip.in || line.start >= clip.out) return;
      const fixed = edit.captionText[lineKey(clip.id, li)];
      if (fixed === "") return;
      // Words said outside the clip's cut are dropped; the rest move onto the edit's clock.
      const words = spreadWords(fixed ?? line.text, line.start, line.end)
        .filter((w) => (w.start + w.end) / 2 >= clip.in && (w.start + w.end) / 2 < clip.out)
        .map((w) => ({
          text: w.text,
          start: starts[ci] + Math.max(0, w.start - clip.in),
          end: starts[ci] + Math.min(clipLength(clip), w.end - clip.in),
        }));
      let cur: CapWord[] = [];
      const flush = () => {
        if (cur.length) groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
        cur = [];
      };
      for (const w of words) {
        const chars = [...cur, w].map((x) => x.text).join(" ").length;
        const pause = cur.length > 0 && w.start - cur[cur.length - 1].end > PAUSE;
        if (cur.length && (cur.length >= MOST_WORDS || chars > MOST_CHARS || pause)) flush();
        cur.push(w);
        if (/[.!?,;:]$/.test(w.text)) flush();
      }
      flush();
    });
  });
  groups.sort((a, b) => a.start - b.start);
  // Hold each caption a beat, but never over the next one.
  for (let i = 0; i < groups.length; i++) {
    const next = groups[i + 1]?.start ?? Infinity;
    groups[i].end = Math.min(next, groups[i].end + HOLD);
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
