"use client";

// Reading video in the browser with Mediabunny (WebCodecs): the file's facts,
// frames to describe, and audio for the transcript. Works on a local File while
// it uploads, or on the stored copy through /api/library/file (Range requests),
// so any teammate can process or re-process a video without downloading it.

export type MediaSource = File | string;

async function open(src: MediaSource) {
  const mb = await import("mediabunny");
  const source = typeof src === "string" ? new mb.UrlSource(src) : new mb.BlobSource(src);
  return { mb, input: new mb.Input({ source, formats: mb.ALL_FORMATS }) };
}

export interface Probe {
  duration: number;
  width?: number;
  height?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  recordedAt?: number;
  location?: { lat: number; lon: number };
}

/** ISO 6709, the way phones write GPS into video: "+26.1224-080.1373+003.000/". */
export function parseISO6709(s: string) {
  const m = s.match(/([+-]\d{1,2}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  if (lat === 0 && lon === 0) return undefined;
  return { lat, lon };
}

/** 3GPP "loci" (ffmpeg and some Android phones): longitude then latitude as 16.16 fixed point. */
export function parseLoci(b: Uint8Array) {
  // version/flags (4) + language (2), then a null-terminated name, then a role byte.
  let o = 6;
  while (o < b.length && b[o] !== 0) o++;
  o += 2;
  if (o + 8 > b.length) return undefined;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const lon = dv.getInt32(o) / 65536;
  const lat = dv.getInt32(o + 4) / 65536;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return undefined;
  return { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
}

/**
 * When an MP4/MOV was made, from its "mvhd" header (seconds since 1904, UTC).
 * Phones that write no creation-date tag still fill this in.
 */
export async function headerCreationTime(file: Blob) {
  const MB4 = 4 * 1024 * 1024;
  const chunks = [file.slice(0, MB4)];
  if (file.size > MB4) chunks.push(file.slice(Math.max(MB4, file.size - MB4)));
  for (const c of chunks) {
    const b = new Uint8Array(await c.arrayBuffer());
    for (let i = 0; i + 16 < b.length; i++) {
      if (b[i] !== 0x6d || b[i + 1] !== 0x76 || b[i + 2] !== 0x68 || b[i + 3] !== 0x64) continue; // "mvhd"
      const dv = new DataView(b.buffer, b.byteOffset + i + 4);
      const version = dv.getUint8(0);
      const secs = version === 1 ? Number(dv.getBigUint64(4)) : dv.getUint32(4);
      const ms = (secs - 2082844800) * 1000;
      // Before 2005 means unset (or a camera with no clock).
      return ms > Date.UTC(2005, 0, 1) && ms < Date.now() + 86_400_000 ? ms : undefined;
    }
  }
  return undefined;
}

const asText = (v: unknown) =>
  typeof v === "string" ? v : v instanceof Uint8Array ? new TextDecoder("latin1").decode(v) : "";

/** Filming date and GPS from the file's own tags (iPhone and most Android phones write both). */
export function readTags(tags: { date?: Date; raw?: Record<string, unknown> }) {
  let recordedAt = tags.date && !isNaN(tags.date.getTime()) ? tags.date.getTime() : undefined;
  let location: Probe["location"];
  for (const [key, value] of Object.entries(tags.raw ?? {})) {
    const k = key.toLowerCase();
    const text = asText(value);
    if (!location && (k.includes("location") || k.endsWith("xyz"))) location = parseISO6709(text);
    if (!location && k === "loci" && value instanceof Uint8Array) location = parseLoci(value);
    if (!recordedAt && k.includes("creationdate")) {
      const t = Date.parse(text.replace(/\0/g, "").trim());
      if (!isNaN(t)) recordedAt = t;
    }
  }
  return { recordedAt, location };
}

export async function probe(src: MediaSource): Promise<Probe> {
  const { input } = await open(src);
  try {
    const [duration, video, audio, tags] = await Promise.all([
      input.computeDuration(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
      input.getMetadataTags().catch(() => ({})),
    ]);
    const [width, height] = video ? await Promise.all([video.getDisplayWidth(), video.getDisplayHeight()]) : [];
    const found = readTags(tags);
    if (!found.recordedAt && typeof src !== "string") found.recordedAt = await headerCreationTime(src).catch(() => undefined);
    return { duration, width, height, hasVideo: !!video, hasAudio: !!audio, ...found };
  } finally {
    input.dispose();
  }
}

/** Seconds between sampled frames: dense for short clips, sparser for long recordings. */
export function frameInterval(duration: number) {
  if (duration <= 60) return 1;
  if (duration <= 600) return 2;
  if (duration <= 1800) return 3;
  return 5;
}

export interface Frame {
  t: number;
  /** ~512px JPEG, base64 without the data: prefix, for Claude. */
  jpeg: string;
  /** ~192px JPEG data URL, for thumbnails. */
  thumb: string;
}

async function canvasToBlob(c: HTMLCanvasElement | OffscreenCanvas, quality: number) {
  if ("convertToBlob" in c) return c.convertToBlob({ type: "image/jpeg", quality });
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", quality));
}

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

function scaled(w: number, h: number, longSide: number) {
  const s = Math.min(1, longSide / Math.max(w, h));
  return { width: Math.max(2, Math.round((w * s) / 2) * 2), height: Math.max(2, Math.round((h * s) / 2) * 2) };
}

/**
 * Walks the video at `every` seconds, calling onBatch with groups of frames.
 * Awaits each batch, so describing a batch overlaps nothing and memory stays flat.
 */
export async function sampleFrames(
  src: MediaSource,
  opts: { duration: number; every: number; batch: number; signal?: AbortSignal },
  onBatch: (frames: Frame[], done: number, total: number) => Promise<void>,
) {
  const { mb, input } = await open(src);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return;
    if (!(await track.canDecode())) throw new Error("This browser can't decode this video's format.");
    const [dw, dh] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);
    const size = scaled(dw, dh, 512);
    const thumbSize = scaled(dw, dh, 192);
    const sink = new mb.CanvasSink(track, { ...size, fit: "contain", poolSize: 2 });
    const times: number[] = [];
    // Start just past zero: a first frame is often black.
    for (let t = Math.min(0.5, opts.duration / 2); t < opts.duration; t += opts.every) times.push(Number(t.toFixed(2)));

    const small = document.createElement("canvas");
    small.width = thumbSize.width;
    small.height = thumbSize.height;
    const sctx = small.getContext("2d")!;

    let pending: Frame[] = [];
    let done = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
      const t = times[done++];
      if (!wrapped) continue;
      sctx.drawImage(wrapped.canvas as CanvasImageSource, 0, 0, small.width, small.height);
      pending.push({
        t,
        jpeg: await blobToBase64(await canvasToBlob(wrapped.canvas, 0.72)),
        thumb: small.toDataURL("image/jpeg", 0.6),
      });
      if (pending.length >= opts.batch) {
        await onBatch(pending, done, times.length);
        pending = [];
      }
    }
    if (pending.length) await onBatch(pending, done, times.length);
  } finally {
    input.dispose();
  }
}

/** Mono 16 kHz, what Whisper expects. OfflineAudioContext does the filtering properly. */
async function to16k(mono: Float32Array, rate: number) {
  if (rate === 16000) return mono;
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil((mono.length * 16000) / rate)), 16000);
  const buf = ctx.createBuffer(1, mono.length, rate);
  buf.copyToChannel(mono as Float32Array<ArrayBuffer>, 0);
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.connect(ctx.destination);
  node.start();
  return (await ctx.startRendering()).getChannelData(0);
}

/**
 * The audio track in windows of `windowSec` seconds, each as mono 16 kHz
 * samples with its start time, so a long recording never sits in memory whole.
 */
export async function* audioWindows(src: MediaSource, windowSec: number, signal?: AbortSignal) {
  const { mb, input } = await open(src);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return;
    if (!(await track.canDecode())) throw new Error("This browser can't decode this video's audio.");
    const sink = new mb.AudioBufferSink(track);
    let parts: Float32Array[] = [];
    let partLen = 0;
    let rate = 0;
    let windowStart = 0;

    const flush = async () => {
      const mono = new Float32Array(partLen);
      let o = 0;
      for (const p of parts) {
        mono.set(p, o);
        o += p.length;
      }
      const out = { start: windowStart, samples: await to16k(mono, rate) };
      windowStart += partLen / rate;
      parts = [];
      partLen = 0;
      return out;
    };

    for await (const { buffer } of sink.buffers()) {
      if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
      rate ||= buffer.sampleRate;
      const n = buffer.length;
      const mono = new Float32Array(n);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < n; i++) mono[i] += data[i] / buffer.numberOfChannels;
      }
      parts.push(mono);
      partLen += n;
      if (partLen >= windowSec * rate) yield await flush();
    }
    if (partLen) yield await flush();
  } finally {
    input.dispose();
  }
}
