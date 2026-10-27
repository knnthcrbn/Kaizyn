"use client";

// Repurposing: one long video into a batch of shorts. Claude reads the
// library transcript and picks the moments that stand on their own
// (/api/studio/shorts); each one picked becomes a 9:16 edit with its hook on
// screen, and if asked a pipeline card, the dead space cut and captions timed
// word by word. Suggestions are kept in this browser per video, so coming
// back doesn't ask Claude again; the shorts made are ordinary edits, shared
// with the team like any other.
import { createStore, get as idbGet, set as idbSet } from "idb-keyval";
import type { Footage } from "../footage/types";
import type { Pillar } from "../types";
import { useHub } from "../store";
import { addClip, createEdit } from "./actions";
import { autoCaptions, removeDeadSpace } from "./ops";
import { defaultOverlay } from "./types";

export type ShortLength = "short" | "medium" | "long";

export const SHORT_LENGTHS: { id: ShortLength; label: string }[] = [
  { id: "short", label: "15–30s" },
  { id: "medium", label: "30–60s" },
  { id: "long", label: "60–90s" },
];

export interface ShortIdea {
  /** Stable within one search: the first and last transcript line. */
  key: string;
  from: number;
  to: number;
  title: string;
  hook: string;
  caption: string;
  why: string;
  score: number;
  pillar: Pillar;
  /** The edit made from it, once made. */
  editId?: string;
}

export interface ShortSearch {
  at: number;
  length: ShortLength;
  count: number;
  ideas: ShortIdea[];
}

const store = typeof indexedDB === "undefined" ? undefined : createStore("content-hub-studio", "shorts");

export const loadSearch = (footageId: string) =>
  store ? idbGet<ShortSearch>(footageId, store).catch(() => undefined) : Promise.resolve(undefined);
export const saveSearch = (footageId: string, s: ShortSearch) => (store ? idbSet(footageId, s, store).catch(() => {}) : Promise.resolve());

/** Long enough to cut shorts from, and already transcribed. */
export const canRepurpose = (f: Footage) => f.uploaded && (f.duration ?? 0) >= 60 && (f.transcript?.length ?? 0) >= 4;

// A short starts a breath before its first word and ends just after its last.
const LEAD = 0.15;
const TAIL = 0.35;

export async function findShorts(f: Footage, length: ShortLength, count: number): Promise<ShortSearch> {
  const lines = (f.transcript ?? []).map((l, i) => ({ i, start: l.start, end: l.end, text: l.text }));
  const res = await fetch("/api/studio/shorts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: f.name, lines, length, count, voice: useHub.getState().voiceProfile }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    shorts?: (Omit<ShortIdea, "key" | "from" | "to"> & { from: number; to: number; start: number; end: number })[];
    error?: string;
  };
  if (!res.ok || !data.shorts) throw new Error(data.error ?? `Finding shorts failed (${res.status}).`);
  const end = f.duration ?? Infinity;
  const ideas = data.shorts.map((s) => ({
    key: `${s.from}-${s.to}`,
    from: Math.max(0, s.start - LEAD),
    to: Math.min(end, s.end + TAIL),
    title: s.title,
    hook: s.hook,
    caption: s.caption,
    why: s.why,
    score: s.score,
    pillar: s.pillar,
  }));
  const search = { at: Date.now(), length, count, ideas };
  await saveSearch(f.id, search);
  return search;
}

export interface MakeOptions {
  /** A pipeline card per short, in Editing, linked to its edit. */
  cards: boolean;
  deadSpace: boolean;
  captions: boolean;
}

/** One idea into an edit (and card). Returns the edit's id. */
export function makeShort(f: Footage, idea: ShortIdea, opts: Pick<MakeOptions, "cards">) {
  const hub = useHub.getState();
  const cardId = opts.cards
    ? hub.addItem({
        title: idea.title,
        pillar: idea.pillar,
        format: "short",
        stage: "editing",
        hooks: [idea.hook],
        overlay: idea.hook,
        caption: idea.caption,
        notes: `Clipped from "${f.name}" (${clock(idea.from)}–${clock(idea.to)}). ${idea.why}`,
      })
    : undefined;
  const editId = createEdit({
    title: idea.title,
    aspect: "9:16",
    cardId,
    overlay: { ...defaultOverlay(), text: idea.hook },
  });
  addClip(editId, f, idea.from, idea.to);
  return editId;
}

/**
 * Makes every idea given, then cuts the dead space and times the captions in
 * each, one after another. `onIdea` hears each edit as it's made, so the
 * screen can link to it straight away.
 */
export async function makeShorts(
  f: Footage,
  ideas: ShortIdea[],
  opts: MakeOptions,
  onIdea: (key: string, editId: string) => void,
  progress: (done: number, note: string) => void,
) {
  const made: string[] = [];
  for (const idea of ideas) {
    const id = makeShort(f, idea, opts);
    onIdea(idea.key, id);
    made.push(id);
  }
  const steps = (opts.deadSpace ? 1 : 0) + (opts.captions ? 1 : 0);
  let cut = 0;
  let timed = 0;
  if (steps) {
    for (let k = 0; k < made.length; k++) {
      const label = `Short ${k + 1} of ${made.length}`;
      const base = k / made.length;
      const share = 1 / made.length / steps;
      let step = 0;
      if (opts.deadSpace) {
        const r = await removeDeadSpace(made[k], "natural", (d) => progress(base + share * d, `${label}: cutting the dead space`));
        cut += r.count;
        step++;
      }
      if (opts.captions) {
        const r = await autoCaptions(made[k], (d) => progress(base + share * (step + d), `${label}: timing the captions`));
        if (r.timed) timed++;
      }
    }
  }
  const parts = [`Made ${made.length} short${made.length === 1 ? "" : "s"}`];
  if (opts.cards) parts.push(`each with a card in Editing`);
  if (opts.deadSpace) parts.push(`${cut} pause${cut === 1 ? "" : "s"} cut`);
  if (opts.captions) parts.push(timed === made.length ? "captions timed word by word" : "captions made");
  return parts.join(", ") + ".";
}

export const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
