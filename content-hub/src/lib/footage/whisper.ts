"use client";

// Speech to text in the browser: Whisper through Transformers.js, in a module
// worker so the page stays responsive. The library and model load from their
// CDNs on first use (the model, ~80 MB, is cached by the browser after that),
// so the app bundle stays small and transcripts cost nothing per minute.

const WORKER = `
const CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js";
// English models, best first; later ones are fallbacks if a repo can't be loaded.
const MODELS = ["onnx-community/whisper-base.en", "Xenova/whisper-base.en", "Xenova/whisper-tiny.en"];
// Studio's auto captions time every word. These exports carry the attention
// heads that alignment needs; they run on WASM, where word times work.
const WORD_MODELS = ["onnx-community/whisper-base.en_timestamped", "onnx-community/whisper-base_timestamped", "onnx-community/whisper-tiny.en_timestamped"];
let loading = null;
let wordLoading = null;
let noGpu = false;

async function load() {
  const { pipeline, env } = await import(CDN);
  env.allowLocalModels = false;
  let gpu = false;
  if (!noGpu && self.navigator && self.navigator.gpu) {
    try { gpu = !!(await self.navigator.gpu.requestAdapter()); } catch (e) { gpu = false; }
  }
  const tries = [];
  for (const model of MODELS) {
    if (gpu) tries.push({ model, device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } });
    tries.push({ model, device: "wasm", dtype: "q8" });
  }
  let last;
  for (const t of tries) {
    try {
      const asr = await pipeline("automatic-speech-recognition", t.model, {
        device: t.device,
        dtype: t.dtype,
        progress_callback: (p) => {
          if (p && p.status === "progress") self.postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
        },
      });
      return { asr, device: t.device, model: t.model };
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("No speech model could be loaded.");
}

async function loadWords() {
  const { pipeline, env } = await import(CDN);
  env.allowLocalModels = false;
  let last;
  for (const model of WORD_MODELS) {
    for (const dtype of ["q8", "fp32"]) {
      try {
        const asr = await pipeline("automatic-speech-recognition", model, {
          device: "wasm",
          dtype,
          progress_callback: (p) => {
            if (p && p.status === "progress") self.postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
          },
        });
        return { asr, device: "wasm", model };
      } catch (e) {
        last = e;
      }
    }
  }
  throw last || new Error("No word-timing model could be loaded.");
}

async function runWords(audio) {
  try {
    wordLoading = wordLoading || loadWords();
    const { asr, device, model } = await wordLoading;
    const out = await asr(audio, { return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5 });
    return { chunks: out.chunks || [], text: out.text || "", device, model, words: true };
  } catch (e) {
    // No word timing here: phrase timing still makes captions, just less exact.
    wordLoading = null;
    const r = await run(audio);
    return { ...r, words: false };
  }
}

async function run(audio) {
  loading = loading || load();
  const { asr, device, model } = await loading;
  const out = await asr(audio, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
  return { chunks: out.chunks || [], text: out.text || "", device, model };
}

self.onmessage = async (e) => {
  const { id, audio, words } = e.data;
  try {
    let result;
    try {
      result = words ? await runWords(audio) : await run(audio);
    } catch (err) {
      // Some GPUs load the model and then fail mid-run; WASM always works, just slower.
      const l = loading && (await loading.catch(() => null));
      if (l && l.device === "webgpu") {
        noGpu = true;
        loading = null;
        result = await run(audio);
      } else {
        loading = null;
        throw err;
      }
    }
    self.postMessage({ type: "result", id, ...result });
  } catch (err) {
    self.postMessage({ type: "error", id, error: String((err && err.message) || err) });
  }
};
`;

export interface WhisperChunk {
  timestamp: [number, number | null];
  text: string;
}

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (v: WhisperChunk[] & { words?: boolean }) => void; reject: (e: Error) => void }>();
const progressListeners = new Set<(loaded: number, total: number) => void>();
const downloads = new Map<string, { loaded: number; total: number }>();

function getWorker() {
  if (worker) return worker;
  const url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }));
  worker = new Worker(url, { type: "module" });
  worker.onmessage = (e: MessageEvent) => {
    const d = e.data as
      | { type: "progress"; file: string; loaded: number; total: number }
      | { type: "result"; id: number; chunks: WhisperChunk[]; words?: boolean }
      | { type: "error"; id: number; error: string };
    if (d.type === "progress") {
      downloads.set(d.file, { loaded: d.loaded ?? 0, total: d.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const v of downloads.values()) {
        loaded += v.loaded;
        total += v.total;
      }
      for (const fn of progressListeners) fn(loaded, total);
      return;
    }
    const w = waiting.get(d.id);
    if (!w) return;
    waiting.delete(d.id);
    if (d.type === "result") w.resolve(Object.assign(d.chunks, { words: !!d.words }));
    else w.reject(new Error(d.error));
  };
  worker.onerror = (e) => {
    for (const w of waiting.values()) w.reject(new Error(e.message || "The speech model crashed."));
    waiting.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/**
 * Transcribes mono 16 kHz audio; timestamps are relative to its start. With
 * `words`, each chunk is one word (the result's `words` says whether word
 * timing worked, or it fell back to phrases).
 */
export function transcribe(samples: Float32Array, opts: { words?: boolean } = {}): Promise<WhisperChunk[] & { words?: boolean }> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    // A copy: the samples may belong to an AudioBuffer, whose memory can't be handed over.
    const audio = new Float32Array(samples);
    getWorker().postMessage({ id, audio, words: !!opts.words }, [audio.buffer]);
  });
}

/** Model download progress (first use only). Returns an unsubscribe. */
export function onModelDownload(fn: (loaded: number, total: number) => void) {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}
