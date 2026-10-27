"use client";

// Exports an edit to a video file, in the browser. Each clip's frames are
// decoded from the library copy (streamed in pieces, so a big raw file is
// never downloaded whole), drawn with the same drawFrame as the preview,
// and encoded with WebCodecs through Mediabunny. Nothing heavy runs on the
// server, so there's no time limit and no render bill.
//
// MP4 (H.264 + AAC) where the browser can make it, which is every desktop
// Chrome, Edge and Safari; WebM (VP9 + Opus) otherwise.
import { fileUrl } from "../footage/api";
import type { Footage } from "../footage/types";
import { buildCaptions } from "./captions";
import { drawFrame, loadFonts } from "./render";
import { aspectSize, clipLength, type Aspect, type Edit, type EditClip } from "./types";

export const FPS = 30;
const RATE = 48_000;

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** "mp4" or "webm". */
  ext: string;
}

export interface ExportProgress {
  /** 0..1 */
  done: number;
  note: string;
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, " ").slice(0, 60) || "edit";

/** One clip's sound, cut to its frames, as 48 kHz stereo. Silence when muted or soundless. */
async function clipAudio(mb: typeof import("mediabunny"), input: import("mediabunny").Input, clip: EditClip, seconds: number) {
  const length = Math.max(1, Math.round(seconds * RATE));
  const silence = () => new AudioBuffer({ length, numberOfChannels: 2, sampleRate: RATE });
  if (clip.muted) return silence();
  const track = await input.getPrimaryAudioTrack();
  if (!track || !(await track.canDecode())) return silence();

  const parts: import("mediabunny").WrappedAudioBuffer[] = [];
  for await (const part of new mb.AudioBufferSink(track).buffers(clip.in, clip.in + seconds)) parts.push(part);
  if (!parts.length) return silence();

  // Lay the decoded pieces end to end at the source's own rate...
  const srcRate = parts[0].buffer.sampleRate;
  const channels = parts[0].buffer.numberOfChannels;
  const srcLength = Math.max(1, Math.round(seconds * srcRate));
  const joined = new AudioBuffer({ length: srcLength, numberOfChannels: channels, sampleRate: srcRate });
  for (const p of parts) {
    const at = Math.round((p.timestamp - clip.in) * srcRate);
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
  // ...then let Web Audio resample it and mix it to stereo.
  const ctx = new OfflineAudioContext(2, length, RATE);
  const node = ctx.createBufferSource();
  node.buffer = joined;
  node.connect(ctx.destination);
  node.start();
  return ctx.startRendering();
}

/**
 * Renders `edit` at `aspect` (the edit's own shape unless another is given).
 * Throws on a missing clip rather than exporting a video with a hole in it.
 */
export async function exportEdit(
  edit: Edit,
  items: Record<string, Footage | undefined>,
  opts: { aspect?: Aspect; signal?: AbortSignal; onProgress?: (p: ExportProgress) => void } = {},
): Promise<ExportResult> {
  const aspect = opts.aspect ?? edit.aspect;
  const shaped: Edit = { ...edit, aspect };
  const { w: W, h: H } = aspectSize(aspect);
  if (!edit.clips.length) throw new Error("Add a clip first.");
  for (const c of edit.clips) {
    const f = items[c.footageId];
    if (!f) throw new Error("One of the clips' videos is no longer in the library.");
    if (!f.uploaded) throw new Error(`"${f.name}" hasn't finished uploading.`);
  }

  const mb = await import("mediabunny");
  await loadFonts();
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
  if (!audioCodec && edit.clips.some((c) => !c.muted)) {
    throw new Error("This browser can't make the video's sound. Export from Chrome or Edge on a computer.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const groups = buildCaptions(shaped, items);

  const target = new mb.BufferTarget();
  const output = new mb.Output({
    format: mp4 ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(),
    target,
  });
  const video = new mb.CanvasSource(canvas, { codec: videoCodec, quality: mb.QUALITY_HIGH });
  output.addVideoTrack(video, { frameRate: FPS });
  const audio = audioCodec ? new mb.AudioBufferSource({ codec: audioCodec, quality: mb.QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  const frames = edit.clips.map((c) => Math.max(1, Math.round(clipLength(c) * FPS)));
  const total = frames.reduce((a, b) => a + b, 0);
  let frame = 0;
  const stopped = () => {
    if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
  };

  try {
    for (let ci = 0; ci < edit.clips.length; ci++) {
      const clip = edit.clips[ci];
      const item = items[clip.footageId]!;
      const n = frames[ci];
      const startFrame = frame;
      progress(frame / total, `Clip ${ci + 1} of ${edit.clips.length}`);
      const input = new mb.Input({ source: new mb.UrlSource(fileUrl(item.file.path)), formats: mb.ALL_FORMATS });
      try {
        // Sound first: it's small, and the file interleaves better with it ahead.
        if (audio) await audio.add(await clipAudio(mb, input, clip, n / FPS));
        stopped();

        const track = await input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode())) throw new Error(`This browser can't read "${item.name}".`);
        const [sw, sh] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);
        // Decode no bigger than the frame needs (a 4K source for a 1080 export decodes at 1080).
        const need = clip.fit === "fill" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
        const s = Math.min(1, need * Math.max(1, clip.zoom));
        const sink = new mb.CanvasSink(track, {
          width: Math.max(2, Math.round(sw * s)),
          height: Math.max(2, Math.round(sh * s)),
          fit: "fill",
          poolSize: 2,
        });
        const times = Array.from({ length: n }, (_, k) => clip.in + k / FPS + 1e-4);
        let last: { image: CanvasImageSource; width: number; height: number } | null = null;
        let k = 0;
        for await (const wrapped of sink.canvasesAtTimestamps(times)) {
          stopped();
          if (wrapped) last = { image: wrapped.canvas, width: wrapped.canvas.width, height: wrapped.canvas.height };
          const t = (startFrame + k) / FPS;
          drawFrame(ctx, W, H, shaped, clip, last, groups, t);
          await video.add(t, 1 / FPS);
          k++;
          frame++;
          if (frame % 15 === 0) progress(frame / total, `Clip ${ci + 1} of ${edit.clips.length}`);
        }
        // A source shorter than its cut: hold the last frame for the rest.
        for (; k < n; k++, frame++) {
          const t = (startFrame + k) / FPS;
          drawFrame(ctx, W, H, shaped, clip, last, groups, t);
          await video.add(t, 1 / FPS);
        }
      } finally {
        input.dispose();
      }
    }
    progress(1, "Finishing");
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }

  const ext = mp4 ? "mp4" : "webm";
  return {
    blob: new Blob([target.buffer!], { type: mp4 ? "video/mp4" : "video/webm" }),
    filename: `${safeName(edit.title)} ${aspect.replace(":", "x")}.${ext}`,
    ext,
  };
}
