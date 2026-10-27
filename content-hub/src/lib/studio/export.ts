"use client";

// Exports an edit to a video file, in the browser. Each piece of each clip is
// decoded from the library copy (streamed in pieces, so a big raw file is
// never downloaded whole), drawn with the same drawFrame as the preview, and
// encoded with WebCodecs through Mediabunny. Nothing heavy runs on the
// server, so there's no time limit and no render bill.
//
// MP4 (H.264 + AAC) where the browser can make it, which is every desktop
// Chrome, Edge and Safari; WebM (VP9 + Opus) otherwise. Sound is made in
// 8-second windows just ahead of the frames, so a long YouTube edit never
// holds its whole soundtrack in memory, and can stream straight to a file.
import type { Input, InputAudioTrack } from "mediabunny";
import { fileUrl } from "../footage/api";
import type { Footage } from "../footage/types";
import { buildCaptions } from "./captions";
import { drawFrame, loadFonts } from "./render";
import { aspectSize, segLength, segments, withDefaults, type Aspect, type Edit, type EditMusic } from "./types";

export const FPS = 30;
const RATE = 48_000;
const WINDOW = 8; // seconds of sound made at a time

export interface ExportResult {
  /** Null when the video was written straight to a file on disk. */
  blob: Blob | null;
  filename: string;
  /** "mp4" or "webm". */
  ext: string;
  size: number;
}

export interface ExportProgress {
  /** 0..1 */
  done: number;
  note: string;
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, " ").slice(0, 60) || "edit";

export const exportName = (edit: Pick<Edit, "title">, aspect: Aspect, ext: string) => `${safeName(edit.title)} ${aspect.replace(":", "x")}.${ext}`;

/** Which file the browser will make: MP4 where it can encode H.264, else WebM. */
export async function exportFormat(aspect: Aspect) {
  const mb = await import("mediabunny");
  const { w, h } = aspectSize(aspect);
  const codec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1", "vp8"], { width: w, height: h });
  return codec === "avc" ? "mp4" : "webm";
}

/** A source's sound between two moments, resampled to 48 kHz stereo, exactly `length` samples long. */
async function sourceSound(mb: typeof import("mediabunny"), track: InputAudioTrack | null, from: number, to: number, length: number) {
  const out = [new Float32Array(length), new Float32Array(length)];
  if (!track || length <= 0) return out;
  const parts: import("mediabunny").WrappedAudioBuffer[] = [];
  for await (const p of new mb.AudioBufferSink(track).buffers(from, to)) parts.push(p);
  if (!parts.length) return out;
  const srcRate = parts[0].buffer.sampleRate;
  const channels = parts[0].buffer.numberOfChannels;
  const srcLength = Math.max(1, Math.round((to - from) * srcRate));
  const joined = new AudioBuffer({ length: srcLength, numberOfChannels: channels, sampleRate: srcRate });
  for (const p of parts) {
    const at = Math.round((p.timestamp - from) * srcRate);
    for (let ch = 0; ch < Math.min(channels, p.buffer.numberOfChannels); ch++) {
      let data = p.buffer.getChannelData(ch);
      let offset = at;
      if (offset < 0) {
        data = data.subarray(-offset);
        offset = 0;
      }
      if (offset >= srcLength) continue;
      joined.copyToChannel(data.subarray(0, srcLength - offset) as Float32Array<ArrayBuffer>, ch, offset);
    }
  }
  // Web Audio resamples it and mixes it to stereo.
  const ctx = new OfflineAudioContext(2, length, RATE);
  const node = ctx.createBufferSource();
  node.buffer = joined;
  node.connect(ctx.destination);
  node.start();
  const r = await ctx.startRendering();
  return [r.getChannelData(0), r.getChannelData(1)];
}

/** The song, decoded once at 48 kHz. */
async function loadMusic(music: EditMusic) {
  const res = await fetch(fileUrl(music.path));
  if (!res.ok) throw new Error(`Couldn't load the music (${res.status}).`);
  const ctx = new OfflineAudioContext(2, 1, RATE);
  return ctx.decodeAudioData(await res.arrayBuffer());
}

/** Adds the song under [t0, t0 + length) of the edit, with its volume and fades. */
function mixMusic(out: Float32Array[], song: AudioBuffer, music: EditMusic, t0: number, total: number) {
  const left = song.getChannelData(0);
  const right = song.numberOfChannels > 1 ? song.getChannelData(1) : left;
  for (let k = 0; k < out[0].length; k++) {
    const t = t0 + k / RATE;
    const i = Math.round((music.start + t) * RATE);
    if (i < 0 || i >= left.length) continue;
    let g = music.volume;
    if (music.fadeIn) g *= Math.min(1, t / 1.5);
    if (music.fadeOut) g *= Math.min(1, Math.max(0, (total - t) / 2.5));
    out[0][k] += left[i] * g;
    out[1][k] += right[i] * g;
  }
}

/**
 * Renders `edit` at `aspect` (the edit's own shape unless another is given).
 * With `writable` the file streams straight to disk (for long videos); else
 * it's returned as a Blob. Throws on a missing clip rather than exporting a
 * video with a hole in it.
 */
export async function exportEdit(
  raw: Edit,
  items: Record<string, Footage | undefined>,
  opts: {
    aspect?: Aspect;
    signal?: AbortSignal;
    onProgress?: (p: ExportProgress) => void;
    writable?: FileSystemWritableFileStream;
  } = {},
): Promise<ExportResult> {
  const aspect = opts.aspect ?? raw.aspect;
  const edit: Edit = { ...withDefaults(raw), aspect };
  const { w: W, h: H } = aspectSize(aspect);
  const segs = segments(edit);
  if (!segs.length) throw new Error("Add a clip first.");
  for (const c of edit.clips) {
    const f = items[c.footageId];
    if (!f) throw new Error("One of the clips' videos is no longer in the library.");
    if (!f.uploaded) throw new Error(`"${f.name}" hasn't finished uploading.`);
  }

  const mb = await import("mediabunny");
  await loadFonts(edit);
  const progress = (done: number, note: string) => opts.onProgress?.({ done, note });
  progress(0, "Getting ready");

  const videoCodec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1", "vp8"], { width: W, height: H });
  if (!videoCodec) throw new Error("This browser can't make video files. Try Chrome or Edge on a computer.");
  const mp4 = videoCodec === "avc";
  const audioCodec = await mb.getFirstEncodableAudioCodec(mp4 ? ["aac", "opus"] : ["opus", "vorbis"], {
    numberOfChannels: 2,
    sampleRate: RATE,
  });
  // Better no file than one that's silently missing its sound.
  const wantsSound = !!edit.music || edit.clips.some((c) => !c.muted);
  if (!audioCodec && wantsSound) {
    throw new Error("This browser can't make the video's sound. Export from Chrome or Edge on a computer.");
  }

  const song = edit.music ? await loadMusic(edit.music) : null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const groups = buildCaptions(edit, items);

  // A file stream takes Mediabunny's positioned writes ({ type: "write", position, data }) as they are.
  const target = opts.writable
    ? new mb.StreamTarget(opts.writable as unknown as WritableStream<import("mediabunny").StreamTargetChunk>, { chunked: true })
    : new mb.BufferTarget();
  const output = new mb.Output({
    // Straight to disk, the index goes at the end; in memory it goes first so the file starts playing at once.
    format: mp4 ? new mb.Mp4OutputFormat({ fastStart: opts.writable ? false : "in-memory" }) : new mb.WebMOutputFormat(),
    target,
  });
  // Very high: the file is uploaded and squeezed again by Instagram, TikTok or
  // YouTube, and caption edges are the first thing a second squeeze smears.
  const video = new mb.CanvasSource(canvas, { codec: videoCodec, quality: new mb.Quality("very-high") });
  output.addVideoTrack(video, { frameRate: FPS });
  const audio = audioCodec ? new mb.AudioBufferSource({ codec: audioCodec, quality: mb.QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  const frameCounts = segs.map((s) => Math.max(1, Math.round(segLength(s) * FPS)));
  const totalFrames = frameCounts.reduce((a, b) => a + b, 0);
  const totalSeconds = totalFrames / FPS;
  const sampleAt = (f: number) => Math.round((f * RATE) / FPS);
  const sourceGain = edit.sourceVolume ?? 1;
  const inputs = new Map<string, Input>();
  const stopped = () => {
    if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
  };

  try {
    let frame = 0;
    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si];
      const clip = seg.clip;
      const item = items[clip.footageId]!;
      const n = frameCounts[si];
      const first = frame;
      let input = inputs.get(item.id);
      if (!input) {
        input = new mb.Input({ source: new mb.UrlSource(fileUrl(item.file.path)), formats: mb.ALL_FORMATS });
        inputs.set(item.id, input);
      }
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) throw new Error(`This browser can't read "${item.name}".`);
      const soundTrack = clip.muted ? null : await input.getPrimaryAudioTrack();
      const sound = soundTrack && (await soundTrack.canDecode()) ? soundTrack : null;

      const [sw, sh] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);
      // Decode no bigger than the frame needs (a 4K source for a 1080 export decodes at 1080), allowing for zooms.
      const need = clip.fit === "fill" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
      const punch = Math.max(1, ...(clip.zooms ?? []).map((z) => z.scale));
      const s = Math.min(1, need * Math.max(1, clip.zoom) * punch);
      const sink = new mb.CanvasSink(track, { width: Math.max(2, Math.round(sw * s)), height: Math.max(2, Math.round(sh * s)), fit: "fill", poolSize: 2 });

      // Sound for the next window goes in before its frames.
      let soundUpTo = first;
      const addSound = async (untilFrame: number) => {
        if (!audio) return;
        while (soundUpTo < Math.min(untilFrame, first + n)) {
          const f0 = soundUpTo;
          const f1 = Math.min(first + n, f0 + WINDOW * FPS);
          const len = sampleAt(f1) - sampleAt(f0);
          const a = seg.in + (f0 - first) / FPS;
          const b = seg.in + (f1 - first) / FPS;
          const pcm = await sourceSound(mb, sound, a, b, len);
          if (sourceGain !== 1) for (const ch of pcm) for (let i = 0; i < ch.length; i++) ch[i] *= sourceGain;
          if (song && edit.music) mixMusic(pcm, song, edit.music, f0 / FPS, totalSeconds);
          const buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: RATE });
          buf.copyToChannel(pcm[0] as Float32Array<ArrayBuffer>, 0);
          buf.copyToChannel(pcm[1] as Float32Array<ArrayBuffer>, 1);
          await audio.add(buf);
          soundUpTo = f1;
        }
      };

      const times = Array.from({ length: n }, (_, k) => seg.in + k / FPS + 1e-4);
      let last: { image: CanvasImageSource; width: number; height: number } | null = null;
      let k = 0;
      const drawOne = async () => {
        await addSound(frame + 1);
        const t = frame / FPS;
        drawFrame(ctx, W, H, edit, clip, last, groups, t, times[k]);
        await video.add(t, 1 / FPS);
        k++;
        frame++;
        if (frame % 15 === 0) progress(frame / totalFrames, `Piece ${si + 1} of ${segs.length}`);
      };
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        stopped();
        if (wrapped) last = { image: wrapped.canvas, width: wrapped.canvas.width, height: wrapped.canvas.height };
        await drawOne();
      }
      // A source shorter than its cut: hold the last frame for the rest.
      while (k < n) await drawOne();
      await addSound(first + n);
    }
    progress(1, "Finishing");
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  } finally {
    for (const i of inputs.values()) i.dispose();
  }

  const ext = mp4 ? "mp4" : "webm";
  const buffer = target instanceof mb.BufferTarget ? target.buffer : null;
  return {
    blob: buffer ? new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" }) : null,
    filename: exportName(edit, aspect, ext),
    ext,
    size: buffer?.byteLength ?? 0,
  };
}
