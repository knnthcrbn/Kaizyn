"use client";

import { create } from "zustand";
import { createStore, get as idbGet, set as idbSet } from "idb-keyval";
import { uid } from "../store";
import { api, fileUrl, uploadVideo } from "./api";
import { audioWindows, frameInterval, probe, sampleFrames, type Frame, type MediaSource } from "./media";
import { transcribe, onModelDownload } from "./whisper";
import { PATHS, type Footage, type FootageLine, type FootagePatch, type FootageShot, type FootageThumbs } from "./types";

// The shared footage library as this browser sees it, plus the videos this
// browser is uploading or processing right now. Records live on the server;
// a copy is cached in IndexedDB so the catalog opens instantly and only
// changed records are fetched.

export interface Job {
  stage: "queued" | "uploading" | "reading" | "working" | "done" | "error";
  upload?: number;
  visuals?: number;
  transcript?: number;
  /** Speech model download, first use only. */
  model?: number;
  note?: string;
}

interface LibraryState {
  loaded: boolean;
  error?: string;
  storage: "blob" | "local";
  items: Record<string, Footage>;
  folders: string[];
  jobs: Record<string, Job>;
}

export const useLibrary = create<LibraryState>(() => ({
  loaded: false,
  storage: "blob",
  items: {},
  folders: [],
  jobs: {},
}));

const cache = typeof indexedDB === "undefined" ? undefined : createStore("content-hub-footage", "cache");
const CACHE_KEY = "items-v1";

const setItem = (item: Footage) => useLibrary.setState((s) => ({ items: { ...s.items, [item.id]: item } }));
const setJob = (id: string, patch: Partial<Job>) =>
  useLibrary.setState((s) => ({ jobs: { ...s.jobs, [id]: { ...(s.jobs[id] ?? { stage: "queued" }), ...patch } } }));
const clearJob = (id: string) =>
  useLibrary.setState((s) => {
    const jobs = { ...s.jobs };
    delete jobs[id];
    return { jobs };
  });

function saveCache() {
  idbSet(CACHE_KEY, useLibrary.getState().items, cache).catch(() => {});
}

// ---------------------------------------------------------------- loading

let loading: Promise<void> | null = null;

/** Loads the catalog, fetching only records that changed since this browser last saw them. */
export function loadLibrary(force = false) {
  if (loading && !force) return loading;
  loading = (async () => {
    try {
      const cached = ((await idbGet<Record<string, Footage>>(CACHE_KEY, cache).catch(() => undefined)) ?? {}) as Record<string, Footage>;
      if (!useLibrary.getState().loaded && Object.keys(cached).length) useLibrary.setState({ items: cached });
      const cat = await api.catalog();
      const stale = cat.items.filter((x) => !cached[x.id] || cached[x.id].updatedAt < x.updatedAt - 1000).map((x) => x.id);
      const fresh = stale.length ? (await api.items(stale)).items : [];
      const items: Record<string, Footage> = {};
      for (const x of cat.items) if (cached[x.id]) items[x.id] = cached[x.id];
      for (const f of fresh) items[f.id] = f;
      // Keep anything this browser is still creating.
      for (const id of Object.keys(useLibrary.getState().jobs)) {
        const mine = useLibrary.getState().items[id];
        if (mine && !items[id]) items[id] = mine;
      }
      useLibrary.setState({ items, folders: cat.folders, storage: cat.storage, loaded: true, error: undefined });
      saveCache();
    } catch (e) {
      useLibrary.setState({ loaded: true, error: (e as Error).message });
    }
  })();
  return loading;
}

// ---------------------------------------------------------------- edits

export async function updateFootage(id: string, patch: FootagePatch) {
  const current = useLibrary.getState().items[id];
  if (current) {
    const { errors: _e, ...rest } = patch;
    void _e;
    setItem({ ...current, ...rest, steps: { ...current.steps, ...patch.steps } });
  }
  const { item } = await api.patch(id, patch);
  setItem(item);
  saveCache();
  return item;
}

export async function deleteFootage(id: string) {
  controllers.get(id)?.abort();
  await api.remove(id);
  useLibrary.setState((s) => {
    const items = { ...s.items };
    delete items[id];
    return { items };
  });
  clearJob(id);
  saveCache();
}

const cleanFolder = (f: string) => f.trim().replace(/\/+/g, "/").replace(/^\/|\/$/g, "");

/** Every folder: the saved list plus any a video sits in, with their parents. */
export function allFolders(state: Pick<LibraryState, "folders" | "items"> = useLibrary.getState()) {
  const set = new Set<string>();
  const add = (f: string) => {
    const parts = cleanFolder(f).split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join("/"));
  };
  state.folders.forEach(add);
  Object.values(state.items).forEach((i) => i.folder && add(i.folder));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function addFolder(name: string, parent = "") {
  const path = cleanFolder(parent ? `${parent}/${name}` : name);
  if (!path) return;
  const folders = [...new Set([...useLibrary.getState().folders, path])];
  useLibrary.setState({ folders });
  useLibrary.setState({ folders: (await api.saveFolders(folders)).folders });
  return path;
}

/** Renames a folder (and its subfolders), moving the videos in it. */
export async function renameFolder(from: string, to: string) {
  const target = cleanFolder(to);
  if (!target || target === from) return;
  const remap = (f: string) => (f === from ? target : f.startsWith(`${from}/`) ? target + f.slice(from.length) : f);
  const s = useLibrary.getState();
  await Promise.all(
    Object.values(s.items)
      .filter((i) => remap(i.folder) !== i.folder)
      .map((i) => updateFootage(i.id, { folder: remap(i.folder) })),
  );
  const folders = [...new Set(allFolders().map(remap))];
  useLibrary.setState({ folders: (await api.saveFolders(folders)).folders });
}

/** Removes a folder; its videos move up to the parent folder. */
export async function deleteFolder(path: string) {
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const inside = (f: string) => f === path || f.startsWith(`${path}/`);
  const s = useLibrary.getState();
  await Promise.all(Object.values(s.items).filter((i) => inside(i.folder)).map((i) => updateFootage(i.id, { folder: parent })));
  const folders = allFolders().filter((f) => !inside(f));
  useLibrary.setState({ folders: (await api.saveFolders(folders)).folders });
}

// ---------------------------------------------------------------- adding & processing

const controllers = new Map<string, AbortController>();
const queue: (() => Promise<void>)[] = [];
let running = 0;
// Two at a time: enough to keep a fast connection busy without starving the decoder.
const PARALLEL = 2;

function pump() {
  while (running < PARALLEL && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      pump();
    });
  }
}

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|3gp)$/i;
export const isVideoFile = (f: File) => f.type.startsWith("video/") || VIDEO_EXT.test(f.name);

/** Adds videos to the library: each uploads and gets processed in this browser at the same time. */
export async function addVideos(files: File[], folder: string) {
  for (const file of files.filter(isVideoFile)) {
    const id = uid();
    const now = Date.now();
    const item: Footage = {
      id,
      name: file.name.replace(/\.[^.]+$/, ""),
      folder,
      file: { path: PATHS.file(id, file.name), name: file.name, size: file.size, type: file.type || "video/mp4" },
      createdAt: now,
      updatedAt: now,
      tags: [],
      uploaded: false,
      steps: { transcript: "pending", visuals: "pending" },
      ...(file.lastModified ? { recordedAt: file.lastModified } : {}),
    };
    setItem(item);
    setJob(id, { stage: "queued" });
    queue.push(async () => {
      const ac = new AbortController();
      controllers.set(id, ac);
      try {
        await api.create(item);
        setJob(id, { stage: "uploading", upload: 0 });
        const upload = uploadVideo(file, item.file.path, useLibrary.getState().storage, (pct) => setJob(id, { upload: pct }), ac.signal)
          .then(() => updateFootage(id, { uploaded: true, errors: { upload: null } }))
          .catch(async (e) => {
            if ((e as Error).name !== "AbortError") await updateFootage(id, { errors: { upload: (e as Error).message } }).catch(() => {});
            throw e;
          });
        // Processing reads the local file, so it doesn't wait for the upload.
        const work = processVideo(id, file, ac.signal);
        await Promise.allSettled([upload, work]);
        const it = useLibrary.getState().items[id];
        setJob(id, { stage: it?.errors?.upload || it?.errors?.visuals || it?.errors?.transcript ? "error" : "done" });
      } catch (e) {
        setJob(id, { stage: "error", note: (e as Error).message });
      } finally {
        controllers.delete(id);
        setTimeout(() => useLibrary.getState().jobs[id]?.stage === "done" && clearJob(id), 4000);
      }
    });
  }
  pump();
}

/** Runs (or re-runs) processing on a stored video, reading it from storage. */
export function reprocess(id: string) {
  const item = useLibrary.getState().items[id];
  if (!item || controllers.has(id)) return;
  setJob(id, { stage: "queued" });
  queue.push(async () => {
    const ac = new AbortController();
    controllers.set(id, ac);
    try {
      await processVideo(id, fileUrl(item.file.path), ac.signal);
      const it = useLibrary.getState().items[id];
      setJob(id, { stage: it?.errors?.visuals || it?.errors?.transcript ? "error" : "done" });
    } catch (e) {
      setJob(id, { stage: "error", note: (e as Error).message });
    } finally {
      controllers.delete(id);
      setTimeout(() => useLibrary.getState().jobs[id]?.stage === "done" && clearJob(id), 4000);
    }
  });
  pump();
}

export const stopProcessing = (id: string) => controllers.get(id)?.abort();
export const isProcessingHere = (id: string) => controllers.has(id);

async function processVideo(id: string, src: MediaSource, signal: AbortSignal) {
  setJob(id, { stage: "reading" });
  const p = await probe(src);
  const item = useLibrary.getState().items[id];
  await updateFootage(id, {
    duration: p.duration,
    width: p.width,
    height: p.height,
    ...(p.recordedAt ? { recordedAt: p.recordedAt } : {}),
    ...(p.location ? { location: p.location } : {}),
    steps: { visuals: p.hasVideo ? "running" : "skipped", transcript: p.hasAudio ? "running" : "skipped" },
  });
  if (p.location && !item?.location?.place) {
    api
      .place(p.location.lat, p.location.lon)
      .then(({ place }) => updateFootage(id, { location: { ...p.location!, place } }))
      .catch(() => {});
  }
  setJob(id, { stage: "working", visuals: 0, transcript: 0 });
  await Promise.allSettled([
    p.hasVideo ? runVisuals(id, src, p.duration, signal) : Promise.resolve(),
    p.hasAudio ? runTranscript(id, src, p.duration, signal) : Promise.resolve(),
  ]);
}

const BATCH = 12;

async function runVisuals(id: string, src: MediaSource, duration: number, signal: AbortSignal) {
  const every = frameInterval(duration);
  const name = useLibrary.getState().items[id]?.name ?? "";
  const shots: FootageShot[] = [];
  const thumbs: FootageThumbs = {};
  let poster: string | undefined;
  let batches = 0;
  try {
    await sampleFrames(src, { duration, every, batch: BATCH, signal }, async (frames: Frame[], done, total) => {
      if (!poster) poster = frames.find((f) => f.t >= duration * 0.1)?.thumb;
      const send = () => api.describe(frames.map((f) => ({ t: f.t, data: f.jpeg })), every, name);
      // One retry: a single flaky request shouldn't sink an hour of footage.
      const { shots: found } = await send().catch(() => send());
      for (const s of found) {
        const frame = frames.reduce((a, b) => (Math.abs(b.t - s.start) < Math.abs(a.t - s.start) ? b : a));
        thumbs[shots.length] = frame.thumb;
        shots.push(s);
      }
      setJob(id, { visuals: (done / total) * 100 });
      // Save as it goes, so a long video is searchable before it's finished.
      if (++batches % 5 === 0) await updateFootage(id, { shots: [...shots], frameEvery: every });
    });
    poster ??= thumbs[0];
    await api.saveThumbs(id, thumbs);
    thumbCache.set(id, thumbs);
    await updateFootage(id, {
      shots,
      frameEvery: every,
      ...(poster ? { poster } : {}),
      steps: { visuals: "done" },
      errors: { visuals: null },
    });
  } catch (e) {
    const stopped = (e as Error).name === "AbortError";
    if (shots.length) await api.saveThumbs(id, thumbs).catch(() => {});
    await updateFootage(id, {
      shots,
      frameEvery: every,
      ...(poster ? { poster } : {}),
      steps: { visuals: "error" },
      errors: { visuals: stopped ? "Stopped before it finished." : (e as Error).message },
    }).catch(() => {});
    throw e;
  }
}

/** Whisper windows: 5 minutes of audio at a time keeps memory flat on long recordings. */
const WINDOW = 300;

async function runTranscript(id: string, src: MediaSource, duration: number, signal: AbortSignal) {
  const lines: FootageLine[] = [];
  const off = onModelDownload((loaded, total) => total && setJob(id, { model: (loaded / total) * 100 }));
  try {
    for await (const w of audioWindows(src, WINDOW, signal)) {
      const chunks = await transcribe(w.samples);
      const windowEnd = w.start + w.samples.length / 16000;
      chunks.forEach((c, i) => {
        const text = c.text.trim();
        if (!text) return;
        const start = w.start + (c.timestamp[0] ?? 0);
        const end = w.start + (c.timestamp[1] ?? chunks[i + 1]?.timestamp[0] ?? windowEnd - w.start);
        lines.push({ start: Number(start.toFixed(2)), end: Number(Math.max(end, start).toFixed(2)), text });
      });
      setJob(id, { transcript: Math.min(100, (windowEnd / Math.max(duration, 1)) * 100), model: undefined });
      await updateFootage(id, { transcript: [...lines] });
    }
    await updateFootage(id, {
      transcript: lines,
      steps: { transcript: "done" },
      errors: { transcript: null },
    });
  } catch (e) {
    const stopped = (e as Error).name === "AbortError";
    await updateFootage(id, {
      transcript: lines,
      steps: { transcript: "error" },
      errors: { transcript: stopped ? "Stopped before it finished." : (e as Error).message },
    }).catch(() => {});
    throw e;
  } finally {
    off();
  }
}

// ---------------------------------------------------------------- thumbnails

const thumbCache = new Map<string, FootageThumbs>();
const thumbLoads = new Map<string, Promise<FootageThumbs>>();

/** Shot thumbnails for one video, fetched once per visit. */
export function loadThumbs(id: string) {
  const hit = thumbCache.get(id);
  if (hit) return Promise.resolve(hit);
  let p = thumbLoads.get(id);
  if (!p) {
    p = api
      .thumbs(id)
      .then(({ thumbs }) => {
        thumbCache.set(id, thumbs);
        return thumbs;
      })
      .finally(() => thumbLoads.delete(id));
    thumbLoads.set(id, p);
  }
  return p;
}
