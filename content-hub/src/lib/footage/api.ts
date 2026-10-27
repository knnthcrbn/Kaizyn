"use client";

import type { Footage, FootagePatch, FootageShot, FootageThumbs } from "./types";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

const send = (url: string, method: string, body: unknown) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const fileUrl = (path: string) => `/api/library/file?path=${encodeURIComponent(path)}`;

export const api = {
  catalog: () =>
    fetch("/api/library", { cache: "no-store" }).then((r) =>
      json<{ storage: "blob" | "local"; folders: string[]; items: { id: string; updatedAt: number }[] }>(r),
    ),
  items: (ids: string[]) => send("/api/library/items", "POST", { ids }).then((r) => json<{ items: Footage[] }>(r)),
  create: (item: Footage) => send("/api/library/item", "POST", item).then((r) => json<{ item: Footage }>(r)),
  patch: (id: string, patch: FootagePatch) =>
    send("/api/library/item", "PATCH", { id, patch }).then((r) => json<{ item: Footage }>(r)),
  remove: (id: string) => fetch(`/api/library/item?id=${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),
  thumbs: (id: string) => fetch(`/api/library/thumbs?id=${id}`).then((r) => json<{ thumbs: FootageThumbs }>(r)),
  saveThumbs: (id: string, thumbs: FootageThumbs) =>
    send(`/api/library/thumbs?id=${id}`, "PUT", thumbs).then((r) => json<{ ok: true }>(r)),
  saveFolders: (folders: string[]) => send("/api/library/folders", "PUT", { folders }).then((r) => json<{ folders: string[] }>(r)),
  describe: (frames: { t: number; data: string }[], every: number, name: string) =>
    send("/api/library/describe", "POST", { frames, every, name }).then((r) => json<{ shots: FootageShot[] }>(r)),
  expand: (q: string) => send("/api/library/expand", "POST", { q }).then((r) => json<{ terms: string[] }>(r)),
  place: (lat: number, lon: number) => fetch(`/api/library/place?lat=${lat}&lon=${lon}`).then((r) => json<{ place: string }>(r)),
};

/** Puts a video into storage: straight to Blob in production, through the dev route locally. */
export async function uploadVideo(
  file: File,
  path: string,
  storage: "blob" | "local",
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
  type?: string,
) {
  // Studio's fonts and music come through here too, with their own type.
  const contentType = type || file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4");
  if (storage === "blob") {
    const { upload } = await import("@vercel/blob/client");
    await upload(path, file, {
      access: "private",
      handleUploadUrl: "/api/library/upload",
      multipart: true,
      contentType,
      abortSignal: signal,
      onUploadProgress: ({ percentage }) => onProgress(percentage),
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/library/dev-upload?path=${encodeURIComponent(path)}`);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed."));
    signal?.addEventListener("abort", () => {
      xhr.abort();
      reject(new DOMException("Stopped", "AbortError"));
    });
    xhr.send(file);
  });
}

/**
 * Downloads a stored video in 32 MB pieces straight to disk (Chrome and Edge
 * ask where to save it), so a multi-GB original never has to fit in one
 * request. Returns false where the browser can't, to fall back to a plain link.
 */
export async function downloadInPieces(path: string, name: string, size: number, onProgress: (pct: number) => void) {
  const picker = (window as unknown as { showSaveFilePicker?: (o: { suggestedName: string }) => Promise<FileSystemFileHandle> })
    .showSaveFilePicker;
  if (!picker) return false;
  const handle = await picker({ suggestedName: name });
  const out = await handle.createWritable();
  const PIECE = 32 * 1024 * 1024;
  try {
    for (let start = 0; start < size; start += PIECE) {
      const end = Math.min(size, start + PIECE) - 1;
      const res = await fetch(fileUrl(path), { headers: { Range: `bytes=${start}-${end}` } });
      if (!res.ok) throw new Error(`Download failed (${res.status}).`);
      await out.write(new Uint8Array(await res.arrayBuffer()));
      onProgress(((end + 1) / size) * 100);
    }
    await out.close();
  } catch (e) {
    await out.abort().catch(() => {});
    throw e;
  }
  return true;
}
