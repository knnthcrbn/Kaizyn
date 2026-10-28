// Server-side storage for the footage library and the shared hub. On Vercel it
// is the private Blob store "content-hub-footage" (BLOB_READ_WRITE_TOKEN is set
// when the store is connected); anywhere else it is a folder on disk, so both
// can be developed and tested without touching real data.
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";

export const STORAGE: "blob" | "local" = process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";

const LOCAL_ROOT = path.join(process.cwd(), ".footage-dev");
const local = (p: string) => {
  const full = path.join(LOCAL_ROOT, p);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Bad path");
  return full;
};

export async function readJSON<T>(p: string): Promise<T | null> {
  if (STORAGE === "local") {
    try {
      return JSON.parse(await fs.readFile(local(p), "utf8")) as T;
    } catch {
      return null;
    }
  }
  // Records change; read past the CDN cache so an edit shows up at once.
  const res = await get(p, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return (await new Response(res.stream).json()) as T;
}

export async function writeJSON(p: string, data: unknown) {
  const body = JSON.stringify(data);
  if (STORAGE === "local") {
    await fs.mkdir(path.dirname(local(p)), { recursive: true });
    await fs.writeFile(local(p), body);
    return;
  }
  await put(p, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

/** Saves a small file (a screenshot) privately. */
export async function writeBytes(p: string, bytes: Uint8Array, contentType: string) {
  if (STORAGE === "local") {
    await fs.mkdir(path.dirname(local(p)), { recursive: true });
    await fs.writeFile(local(p), bytes);
    return;
  }
  await put(p, Buffer.from(bytes), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });
}

/** Someone else wrote the file between our read and our write. */
export class WriteConflict extends Error {}

const hash = (body: string) => `"${createHash("sha1").update(body).digest("hex")}"`;

/**
 * Reads a JSON file with its version tag. Passing the tag already held skips
 * the download when nothing changed (`unchanged`), which keeps polling cheap.
 */
export async function readTagged<T>(
  p: string,
  since?: string,
): Promise<{ data: T | null; etag: string | null; unchanged?: true }> {
  if (STORAGE === "local") {
    let body: string;
    try {
      body = await fs.readFile(local(p), "utf8");
    } catch {
      return { data: null, etag: null };
    }
    const etag = hash(body);
    return etag === since ? { data: null, etag, unchanged: true } : { data: JSON.parse(body) as T, etag };
  }
  const res = await get(p, { access: "private", useCache: false, ...(since ? { ifNoneMatch: since } : {}) }).catch(
    (e: Error) => (e.name === "BlobNotFoundError" ? null : Promise.reject(e)),
  );
  if (!res) return { data: null, etag: null };
  if (res.statusCode === 304) return { data: null, etag: res.blob.etag, unchanged: true };
  return { data: (await new Response(res.stream).json()) as T, etag: res.blob.etag };
}

/**
 * Writes a JSON file only if it is still at version `etag` (or, with null,
 * only if it doesn't exist yet), so two saves can't silently overwrite each
 * other. Throws WriteConflict when it lost the race; read again and retry.
 */
export async function writeTagged(p: string, data: unknown, etag: string | null): Promise<string> {
  const body = JSON.stringify(data);
  if (STORAGE === "local") {
    // One process in development, so a queue makes check-then-write atomic.
    const run = localWrites.then(async () => {
      const current = await fs.readFile(local(p), "utf8").then(hash, () => null);
      if (current !== etag) throw new WriteConflict();
      await fs.mkdir(path.dirname(local(p)), { recursive: true });
      await fs.writeFile(local(p), body);
      return hash(body);
    });
    localWrites = run.catch(() => {});
    return run;
  }
  try {
    const res = await put(p, body, {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
      ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
    });
    return res.etag;
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) throw new WriteConflict();
    // Creating a file that appeared meanwhile fails with a generic error;
    // the caller re-reads and finds it there.
    if (!etag) throw new WriteConflict((e as Error).message);
    throw e;
  }
}
let localWrites: Promise<unknown> = Promise.resolve();

/** Everything under a prefix, with when each was last written. */
export async function listPrefix(prefix: string): Promise<{ path: string; updatedAt: number; size: number }[]> {
  if (STORAGE === "local") {
    const dir = local(prefix.replace(/\/$/, ""));
    try {
      const names = await fs.readdir(dir);
      return Promise.all(
        names.map(async (n) => {
          const st = await fs.stat(path.join(dir, n));
          return { path: `${prefix.replace(/\/$/, "")}/${n}`, updatedAt: st.mtimeMs, size: st.size };
        }),
      );
    } catch {
      return [];
    }
  }
  const out: { path: string; updatedAt: number; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const b of page.blobs) out.push({ path: b.pathname, updatedAt: new Date(b.uploadedAt).getTime(), size: b.size });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export async function remove(paths: string[]) {
  if (!paths.length) return;
  if (STORAGE === "local") {
    await Promise.all(paths.map((p) => fs.rm(local(p), { force: true })));
    return;
  }
  // Blob deletes by URL or pathname; one call takes many.
  await del(paths);
}

/** Saves a request body as a file (local storage only; production uploads go straight to Blob). */
export async function writeStream(p: string, body: ReadableStream<Uint8Array>) {
  const full = local(p);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const handle = await fs.open(full, "w");
  try {
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) await handle.write(chunk);
  } finally {
    await handle.close();
  }
}

// A player asks for "bytes=N-" (everything from N). Answering in pieces keeps
// each function call short, well inside its time limit, however long the
// video; players and downloads ask again for the next piece by themselves.
const PIECE = 8 * 1024 * 1024;

function clampOpenRange(range: string | null) {
  const m = range?.match(/^bytes=(\d+)-$/);
  return m ? `bytes=${m[1]}-${Number(m[1]) + PIECE - 1}` : range;
}

/**
 * Serves a stored file, honouring Range so a video can be scrubbed and the
 * browser-side processing can read just the parts it needs.
 */
export async function serveFile(p: string, requested: string | null, contentType?: string) {
  const range = clampOpenRange(requested);
  const headers: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };

  if (STORAGE === "local") {
    let size: number;
    try {
      size = (await fs.stat(local(p))).size;
    } catch {
      return new Response("Not found", { status: 404 });
    }
    headers["Content-Type"] = contentType ?? guessType(p);
    const r = parseRange(range, size);
    if (r === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const [start, end] = r ?? [0, size - 1];
    const stream = Readable.toWeb(createReadStream(local(p), { start, end })) as ReadableStream<Uint8Array>;
    headers["Content-Length"] = String(end - start + 1);
    if (r) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    return new Response(stream, { status: r ? 206 : 200, headers });
  }

  const res = await get(p, { access: "private", ...(range ? { headers: { range } } : {}) });
  if (!res || res.statusCode !== 200) return new Response("Not found", { status: 404 });
  headers["Content-Type"] = contentType ?? res.blob.contentType ?? guessType(p);
  const contentRange = res.headers.get("content-range");
  const length = res.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  if (contentRange) headers["Content-Range"] = contentRange;
  return new Response(res.stream, { status: contentRange ? 206 : 200, headers });
}

function parseRange(range: string | null, size: number): [number, number] | null | "invalid" {
  if (!range) return null;
  const m = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return "invalid";
  let start: number;
  let end: number;
  if (!m[1]) {
    // "bytes=-500": the last 500 bytes.
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start > end || start >= size) return "invalid";
  return [start, end];
}

function guessType(p: string) {
  const ext = p.split(".").pop()?.toLowerCase();
  return (
    {
      mp4: "video/mp4",
      m4v: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      json: "application/json",
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      otf: "font/otf",
      ttf: "font/ttf",
      woff: "font/woff",
      woff2: "font/woff2",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      aac: "audio/aac",
      wav: "audio/wav",
      ogg: "audio/ogg",
      opus: "audio/ogg",
      flac: "audio/flac",
    }[ext ?? ""] ?? "application/octet-stream"
  );
}
