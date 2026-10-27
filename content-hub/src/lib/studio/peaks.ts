"use client";

// How loud each footage video is, moment by moment: drawn as the waveform
// under the timeline, and read to find the pauses "Remove dead space" cuts.
//
// Loudness is measured 100 times a second, in 20-second blocks, only for the
// stretches an edit uses (reading a whole hour of raw footage to cut a
// 30-second clip would be wasted work). Blocks are kept in IndexedDB, so a
// video is only ever measured once per browser.
import { create } from "zustand";
import { createStore, get as idbGet, set as idbSet } from "idb-keyval";
import { fileUrl } from "../footage/api";
import type { Footage } from "../footage/types";

export const PEAK_RATE = 100; // values per second
const BLOCK = 20; // seconds per block

const store = typeof indexedDB === "undefined" ? undefined : createStore("content-hub-studio", "peaks");
const blocks = new Map<string, Float32Array>();
const pending = new Map<string, Promise<void>>();

/** Goes up whenever new loudness arrives, so waveforms redraw. */
export const usePeaks = create<{ version: number }>(() => ({ version: 0 }));

const key = (f: Footage, b: number) => `${f.id}:${f.file.size}:${b}`;

async function measure(f: Footage, b: number): Promise<Float32Array> {
  const from = b * BLOCK;
  const to = Math.min(from + BLOCK, f.duration ?? from + BLOCK);
  const out = new Float32Array(Math.max(1, Math.ceil((to - from) * PEAK_RATE)));
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.UrlSource(fileUrl(f.file.path)), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return out;
    // Root mean square of each 10ms window, all channels together.
    const sums = new Float64Array(out.length);
    const counts = new Uint32Array(out.length);
    for await (const { buffer, timestamp } of new mb.AudioBufferSink(track).buffers(from, to)) {
      const rate = buffer.sampleRate;
      const chans = buffer.numberOfChannels;
      const data = Array.from({ length: chans }, (_, c) => buffer.getChannelData(c));
      for (let i = 0; i < buffer.length; i++) {
        const at = Math.floor((timestamp - from + i / rate) * PEAK_RATE);
        if (at < 0 || at >= out.length) continue;
        let v = 0;
        for (let c = 0; c < chans; c++) v += data[c][i] * data[c][i];
        sums[at] += v / chans;
        counts[at]++;
      }
    }
    for (let i = 0; i < out.length; i++) out[i] = counts[i] ? Math.sqrt(sums[i] / counts[i]) : 0;
    return out;
  } finally {
    input.dispose();
  }
}

function loadBlock(f: Footage, b: number) {
  const k = key(f, b);
  if (blocks.has(k)) return Promise.resolve();
  let p = pending.get(k);
  if (p) return p;
  p = (async () => {
    let data = (await idbGet<Float32Array>(k, store).catch(() => undefined)) ?? null;
    if (!data) {
      data = await measure(f, b);
      void idbSet(k, data, store).catch(() => {});
    }
    blocks.set(k, data);
    usePeaks.setState((s) => ({ version: s.version + 1 }));
  })().finally(() => pending.delete(k));
  pending.set(k, p);
  return p;
}

/** Measures the stretch [from, to] of a video, if it hasn't been already. */
export async function loadPeaks(f: Footage, from: number, to: number) {
  if (!f.uploaded) return;
  const first = Math.max(0, Math.floor(from / BLOCK));
  const last = Math.floor(Math.max(from, to - 1e-6) / BLOCK);
  // One block at a time: each reads the file, and the browser has other work.
  for (let b = first; b <= last; b++) await loadBlock(f, b);
}

/** Whether [from, to] has been measured. */
export function hasPeaks(f: Footage, from: number, to: number) {
  for (let b = Math.floor(from / BLOCK); b <= Math.floor(Math.max(from, to - 1e-6) / BLOCK); b++) if (!blocks.has(key(f, b))) return false;
  return true;
}

/** Loudness from `from` to `to`, as `n` values (the loudest in each slot), 0 where not yet measured. */
export function peaksBetween(f: Footage, from: number, to: number, n: number) {
  const out = new Float32Array(Math.max(0, n));
  if (n <= 0 || to <= from) return out;
  const step = (to - from) / n;
  for (let i = 0; i < n; i++) {
    const a = from + i * step;
    const b = a + step;
    let m = 0;
    for (let s = Math.floor(a * PEAK_RATE); s < Math.max(Math.floor(a * PEAK_RATE) + 1, Math.ceil(b * PEAK_RATE)); s++) {
      const blk = blocks.get(key(f, Math.floor(s / (BLOCK * PEAK_RATE))));
      if (!blk) continue;
      const v = blk[s - Math.floor(s / (BLOCK * PEAK_RATE)) * BLOCK * PEAK_RATE] ?? 0;
      if (v > m) m = v;
    }
    out[i] = m;
  }
  return out;
}

export interface Pause {
  from: number;
  to: number;
}

export const PAUSE_PRESETS = {
  tight: { label: "Tight", minGap: 0.25, pad: 0.08 },
  natural: { label: "Natural", minGap: 0.45, pad: 0.12 },
  loose: { label: "Loose", minGap: 0.8, pad: 0.18 },
} as const;
export type PausePreset = keyof typeof PAUSE_PRESETS;

/**
 * The quiet stretches in [from, to] of a video, worth cutting: quieter than a
 * tenth of its speaking level for at least `minGap` seconds. `pad` of each
 * stays, so words don't get clipped at the edges.
 */
export async function findPauses(f: Footage, from: number, to: number, preset: PausePreset): Promise<Pause[]> {
  await loadPeaks(f, from, to);
  const { minGap, pad } = PAUSE_PRESETS[preset];
  const n = Math.max(1, Math.round((to - from) * PEAK_RATE));
  const v = peaksBetween(f, from, to, n);
  const sorted = Float32Array.from(v).sort();
  const speech = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  if (speech < 0.003) return []; // silent footage: nothing to tell apart
  const quiet = Math.max(0.0025, speech * 0.1);
  const out: Pause[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const q = i < n && v[i] < quiet;
    if (q && start < 0) start = i;
    if (!q && start >= 0) {
      const a = from + start / PEAK_RATE;
      const b = from + i / PEAK_RATE;
      // The very start and end of a clip have no word to protect on their outer side.
      const lead = start === 0 ? 0 : pad;
      const tail = i === n ? 0 : pad;
      if (b - a >= minGap && b - tail - (a + lead) > 0.05) out.push({ from: a + lead, to: b - tail });
      start = -1;
    }
  }
  return out;
}
