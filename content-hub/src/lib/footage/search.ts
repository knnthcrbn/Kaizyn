// Searching the footage library: what was said (transcript lines), what was
// shown (shot descriptions, tags, on-screen text), where (place) and what it's
// called (name, folder, tags). Runs in the browser over the loaded records, so
// it's instant; Claude only helps by widening the terms (see /api/library/expand).
import type { Footage } from "./types";

export type HitKind = "said" | "shown" | "place" | "file";

export interface Hit {
  kind: HitKind;
  start: number;
  end: number;
  text: string;
  /** Index into shots, for the thumbnail. */
  shot?: number;
  /** Which search terms matched, for highlighting. */
  terms: string[];
}

export interface Result {
  item: Footage;
  hits: Hit[];
  score: number;
}

export interface SearchFilters {
  kinds: Set<HitKind>;
  /** Only this folder and the ones inside it ("" = everywhere). */
  folder: string;
}

/** Lowercase, plain spaces, no currency signs or digit commas: "$1,000,000" and "1000000" meet. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/[^a-z0-9%.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A term matches at a word start, so "car" finds "cars" but not "scar". */
export function matcher(terms: string[]) {
  const list = [...new Set(terms.map(normalize).filter(Boolean))];
  const res = list.map((t) => ({ t, re: new RegExp(`(?:^|\\s)${escape(t)}`) }));
  return (text: string) => {
    const n = ` ${normalize(text)}`;
    return res.filter(({ re }) => re.test(n)).map(({ t }) => t);
  };
}

export function search(items: Footage[], terms: string[], filters: SearchFilters): Result[] {
  const match = matcher(terms);
  const primary = normalize(terms[0] ?? "");
  const out: Result[] = [];

  for (const item of items) {
    if (filters.folder && item.folder !== filters.folder && !item.folder.startsWith(`${filters.folder}/`)) continue;
    const hits: Hit[] = [];
    const end = item.duration ?? 0;

    if (filters.kinds.has("file")) {
      const t = match([item.name, item.folder, ...item.tags, item.notes ?? ""].join(" "));
      if (t.length) hits.push({ kind: "file", start: 0, end, text: item.name, terms: t });
    }
    if (filters.kinds.has("place") && item.location?.place) {
      const t = match(item.location.place);
      if (t.length) hits.push({ kind: "place", start: 0, end, text: item.location.place, terms: t });
    }
    if (filters.kinds.has("said")) {
      for (const line of item.transcript ?? []) {
        const t = match(line.text);
        if (t.length) hits.push({ kind: "said", start: line.start, end: line.end, text: line.text, terms: t });
      }
    }
    if (filters.kinds.has("shown")) {
      (item.shots ?? []).forEach((s, i) => {
        const t = match([s.description, s.tags.join(" "), s.onScreenText ?? ""].join(" "));
        if (t.length) hits.push({ kind: "shown", start: s.start, end: s.end, text: s.description, shot: i, terms: t });
      });
    }
    if (!hits.length) continue;

    // The exact words searched count most; Claude's wider terms help but rank lower.
    const score = hits.reduce(
      (sum, h) => sum + (h.terms.includes(primary) ? 3 : 1) + (h.kind === "file" || h.kind === "place" ? 2 : 0),
      0,
    );
    hits.sort((a, b) => a.start - b.start || (a.kind === "said" ? -1 : 1));
    out.push({ item, hits, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Splits text around matched terms, for highlighting. */
export function highlight(text: string, terms: string[]) {
  const words = terms.map((t) => t.trim()).filter(Boolean);
  if (!words.length) return [{ text, hit: false }];
  // Matches on the raw text, loosely: case-insensitive, at a word start.
  const re = new RegExp(`(?<![\\w])(${words.map((w) => escape(w).replace(/\s+/g, "[\\s,.-]+")).join("|")})`, "gi");
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i), hit: false });
    parts.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

export const timecode = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
