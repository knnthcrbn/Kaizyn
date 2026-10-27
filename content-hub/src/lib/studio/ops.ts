"use client";

// The bigger Studio actions: cutting the dead space, slicing out a selection,
// auto captions, AI zoom, and putting fonts and music in shared storage.
import { fileUrl, uploadVideo } from "../footage/api";
import { useLibrary } from "../footage/library";
import type { Footage } from "../footage/types";
import { transcribe } from "../footage/whisper";
import { uid, useHub } from "../store";
import { buildCaptions } from "./captions";
import { findPauses, type PausePreset } from "./peaks";
import { contentTypeFor, studioPath, type AssetKind } from "./paths";
import { newUndoStep } from "./undo";
import {
  mergeRanges,
  segLength,
  segments,
  toSource,
  withDefaults,
  type Cut,
  type Edit,
  type EditClip,
  type SrcWord,
  type Zoom,
} from "./types";

// Every action here makes exactly one change, and each is its own undo step.
const update = (id: string, fn: (e: Edit) => Partial<Edit>) => {
  newUndoStep();
  useHub.getState().updateEdit(id, (e) => fn(withDefaults(e)));
};
const current = (id: string) => {
  const e = useHub.getState().edits.find((x) => x.id === id);
  return e ? withDefaults(e) : null;
};
const items = () => useLibrary.getState().items;

// ------------------------------------------------------------------ cuts

/**
 * Cuts the pauses out of every clip. Earlier automatic cuts are replaced;
 * cuts made by hand stay. Returns how many pauses went and how long they ran.
 */
export async function removeDeadSpace(editId: string, preset: PausePreset, onProgress?: (done: number) => void) {
  const e = current(editId);
  if (!e) return { count: 0, seconds: 0 };
  const lib = items();
  const found = new Map<string, Cut[]>();
  let i = 0;
  for (const clip of e.clips) {
    const f = lib[clip.footageId];
    if (f?.uploaded) {
      const pauses = await findPauses(f, clip.in, clip.out, preset);
      found.set(clip.id, pauses.map((p) => ({ ...p, auto: true })));
    }
    onProgress?.(++i / e.clips.length);
  }
  let count = 0;
  let seconds = 0;
  for (const cuts of found.values())
    for (const c of cuts) {
      count++;
      seconds += c.to - c.from;
    }
  update(editId, (x) => ({
    clips: x.clips.map((c) =>
      found.has(c.id) ? { ...c, cuts: mergeRanges([...(c.cuts ?? []).filter((k) => !k.auto), ...found.get(c.id)!]) } : c,
    ),
  }));
  return { count, seconds };
}

/** Puts back every pause "Remove dead space" took out. */
export function restorePauses(editId: string) {
  update(editId, (x) => ({ clips: x.clips.map((c) => ({ ...c, cuts: (c.cuts ?? []).filter((k) => !k.auto) })) }));
}

/** Puts back everything cut out of one clip. */
export function restoreClip(editId: string, clipId: string) {
  update(editId, (x) => ({ clips: x.clips.map((c) => (c.id === clipId ? { ...c, cuts: [] } : c)) }));
}

/** Slices [a, b] of the edit's timeline out, from whichever clips play there. */
export function cutRange(editId: string, a: number, b: number) {
  const e = current(editId);
  if (!e || b - a < 0.02) return;
  const add = new Map<string, Cut[]>();
  for (const s of segments(e)) {
    const from = Math.max(a, s.start);
    const to = Math.min(b, s.start + segLength(s));
    if (to - from < 0.01) continue;
    const list = add.get(s.clip.id) ?? [];
    list.push({ from: s.in + (from - s.start), to: s.in + (to - s.start) });
    add.set(s.clip.id, list);
  }
  update(editId, (x) => ({
    clips: x.clips.map((c) => (add.has(c.id) ? { ...c, cuts: mergeRanges([...(c.cuts ?? []), ...add.get(c.id)!]) } : c)),
  }));
}

// ------------------------------------------------------------------ auto captions

/** A stretch of a video's sound as mono 16 kHz, what Whisper listens to. */
async function speechSamples(f: Footage, from: number, to: number) {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.UrlSource(fileUrl(f.file.path)), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const parts: { data: Float32Array; at: number; rate: number }[] = [];
    for await (const { buffer, timestamp } of new mb.AudioBufferSink(track).buffers(from, to)) {
      const mono = new Float32Array(buffer.length);
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const d = buffer.getChannelData(c);
        for (let i = 0; i < d.length; i++) mono[i] += d[i] / buffer.numberOfChannels;
      }
      parts.push({ data: mono, at: timestamp, rate: buffer.sampleRate });
    }
    if (!parts.length) return null;
    const rate = parts[0].rate;
    const joined = new Float32Array(Math.max(1, Math.round((to - from) * rate)));
    for (const p of parts) {
      const o = Math.round((p.at - from) * rate);
      const src = o < 0 ? p.data.subarray(-o) : p.data;
      const at = Math.max(0, o);
      if (at < joined.length) joined.set(src.subarray(0, joined.length - at), at);
    }
    const ctx = new OfflineAudioContext(1, Math.max(1, Math.round(joined.length * (16000 / rate))), 16000);
    const buf = ctx.createBuffer(1, joined.length, rate);
    buf.copyToChannel(joined as Float32Array<ArrayBuffer>, 0);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(ctx.destination);
    node.start();
    return (await ctx.startRendering()).getChannelData(0);
  } finally {
    input.dispose();
  }
}

const WINDOW = 240; // seconds of speech per pass; a long YouTube clip goes in pieces

/**
 * Listens to every clip and times each word, like CapCut's auto captions.
 * Runs in this browser (Whisper); the first run downloads the speech model.
 * Returns whether true word timing was available (else phrases were spread).
 */
export async function autoCaptions(editId: string, onProgress?: (done: number, note: string) => void) {
  const e = current(editId);
  if (!e) return { words: 0, timed: false };
  const lib = items();
  const clips = e.clips.filter((c) => lib[c.footageId]?.uploaded);
  let timed = true;
  let count = 0;
  const done = new Map<string, Pick<EditClip, "words" | "wordsSpan">>();
  for (let ci = 0; ci < clips.length; ci++) {
    const clip = clips[ci];
    const f = lib[clip.footageId]!;
    const from = Math.max(0, clip.in - 0.3);
    const to = Math.min(f.duration ?? clip.out + 0.3, clip.out + 0.3);
    const words: SrcWord[] = [];
    for (let w0 = from; w0 < to; w0 += WINDOW) {
      const w1 = Math.min(to, w0 + WINDOW);
      onProgress?.((ci + (w0 - from) / (to - from)) / clips.length, `Listening to clip ${ci + 1} of ${clips.length}`);
      const samples = await speechSamples(f, w0, w1);
      if (!samples) continue;
      const chunks = await transcribe(samples, { words: true });
      if (!chunks.words) timed = false;
      for (const ch of chunks) {
        const text = ch.text.trim();
        if (!text) continue;
        const start = w0 + (ch.timestamp[0] ?? 0);
        const end = w0 + (ch.timestamp[1] ?? ch.timestamp[0] ?? 0);
        if (chunks.words) words.push({ text, start, end: Math.max(end, start + 0.05) });
        else {
          // Phrase timing only: spread the phrase's words across it.
          const parts = text.split(/\s+/);
          const len = Math.max(0.2, end - start);
          parts.forEach((p, k) => words.push({ text: p, start: start + (len * k) / parts.length, end: start + (len * (k + 1)) / parts.length }));
        }
      }
    }
    count += words.length;
    done.set(clip.id, { words, wordsSpan: [from, to] });
  }
  onProgress?.(1, "Done");
  // Fixes made to the old wording would point at lines that no longer exist.
  update(editId, (x) => ({
    clips: x.clips.map((c) => (done.has(c.id) ? { ...c, ...done.get(c.id)! } : c)),
    captionText: Object.fromEntries(Object.entries(x.captionText).filter(([k]) => !done.has(k.split(":")[0]))),
    captions: { ...x.captions, on: true },
  }));
  return { words: count, timed };
}

/** Whether a clip's auto captions no longer cover its cut (it was trimmed wider since). */
export const captionsStale = (c: EditClip) => !!c.wordsSpan && (c.in < c.wordsSpan[0] - 0.05 || c.out > c.wordsSpan[1] + 0.05);

// ------------------------------------------------------------------ AI zoom

export const ZOOM_SCALE = { punch: 1.15, strong: 1.3 };

/**
 * Claude reads the captions and picks the lines to punch in on; each becomes
 * a zoom on its clip. Earlier AI zooms are replaced; zooms added by hand stay.
 */
export async function aiZoom(editId: string, intensity = 1) {
  const e = current(editId);
  if (!e) return 0;
  const groups = buildCaptions({ ...e, captions: { ...e.captions, on: true } }, items());
  const words = groups.flatMap((g) => g.words);
  if (!words.length) throw new Error("There's nothing said to read yet. Run auto captions first.");
  const res = await fetch("/api/studio/emphasis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      words: words.map((w, i) => ({ i, w: w.text, t: Math.round(w.start * 10) / 10 })),
      long: e.aspect === "16:9",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { moments?: { from: number; to: number; strength: "punch" | "strong" }[]; error?: string };
  if (!res.ok || !data.moments) throw new Error(data.error ?? `AI zoom failed (${res.status}).`);

  const segs = segments(e);
  const add = new Map<string, Zoom[]>();
  for (const m of data.moments) {
    const a = words[m.from];
    const b = words[m.to];
    if (!a || !b) continue;
    const start = toSource(segs, a.start + 0.01);
    if (!start) continue;
    // A moment that runs into the next clip stops at the end of this one.
    const endT = Math.min(b.end + 0.1, a.start + 3.2);
    const end = toSource(segs, endT);
    const to = end && end.clip.id === start.clip.id ? end.source : start.clip.out;
    const scale = 1 + (ZOOM_SCALE[m.strength] - 1) * intensity;
    const list = add.get(start.clip.id) ?? [];
    list.push({ from: Math.max(start.clip.in, start.source - 0.05), to, scale, auto: true });
    add.set(start.clip.id, list);
  }
  let n = 0;
  for (const l of add.values()) n += l.length;
  update(editId, (x) => ({
    clips: x.clips.map((c) => ({ ...c, zooms: [...(c.zooms ?? []).filter((z) => !z.auto), ...(add.get(c.id) ?? [])] })),
  }));
  return n;
}

/** A zoom of `seconds` at the playhead, added by hand. */
export function addZoomAt(editId: string, t: number, seconds = 1.5, scale = ZOOM_SCALE.punch) {
  const e = current(editId);
  if (!e) return;
  const at = toSource(segments(e), t);
  if (!at) return;
  const zoom: Zoom = { from: at.source, to: Math.min(at.clip.out, at.source + seconds), scale };
  update(editId, (x) => ({ clips: x.clips.map((c) => (c.id === at.clip.id ? { ...c, zooms: [...(c.zooms ?? []), zoom] } : c)) }));
}

export function clearZooms(editId: string, onlyAuto = false) {
  update(editId, (x) => ({ clips: x.clips.map((c) => ({ ...c, zooms: onlyAuto ? (c.zooms ?? []).filter((z) => !z.auto) : [] })) }));
}

// ------------------------------------------------------------------ files

/** Puts a font or song in shared storage and returns where. */
export async function uploadAsset(kind: AssetKind, file: File, onProgress?: (pct: number) => void) {
  const path = studioPath(kind, uid(), file.name);
  await uploadVideo(file, path, useLibrary.getState().storage, onProgress ?? (() => {}), undefined, contentTypeFor(file.name, file.type));
  return path;
}

export interface StoredAsset {
  path: string;
  name: string;
  size: number;
  updatedAt: number;
}

export async function listAssets(kind: AssetKind): Promise<StoredAsset[]> {
  const res = await fetch(`/api/studio/assets?kind=${kind}`, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { files?: StoredAsset[] };
  return data.files ?? [];
}

/** How long a song runs, read from the file. */
export async function audioDuration(src: File | string) {
  const mb = await import("mediabunny");
  const input = new mb.Input({
    source: typeof src === "string" ? new mb.UrlSource(fileUrl(src)) : new mb.BlobSource(src),
    formats: mb.ALL_FORMATS,
  });
  try {
    return await input.computeDuration();
  } finally {
    input.dispose();
  }
}
