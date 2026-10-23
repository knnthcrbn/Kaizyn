import { readJSON, remove, writeJSON } from "@/lib/footage/store";
import { PATHS, type Footage, type FootagePatch } from "@/lib/footage/types";

const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{6,40}$/.test(id);

/** Creates a record (a new video). */
export async function POST(req: Request) {
  const item = (await req.json().catch(() => null)) as Footage | null;
  if (!item || !validId(item.id)) return Response.json({ error: "Bad record" }, { status: 400 });
  item.updatedAt = Date.now();
  await writeJSON(PATHS.meta(item.id), item);
  return Response.json({ item });
}

/**
 * Merges a change into a record. Read-merge-write on the server, so a rename
 * from one person doesn't wipe a transcript another person's browser just saved.
 */
export async function PATCH(req: Request) {
  const { id, patch } = (await req.json().catch(() => ({}))) as { id?: string; patch?: FootagePatch };
  if (!validId(id) || !patch) return Response.json({ error: "Bad change" }, { status: 400 });
  const current = await readJSON<Footage>(PATHS.meta(id));
  if (!current) return Response.json({ error: "That video is gone." }, { status: 404 });
  const errors: Record<string, string> = { ...current.errors };
  for (const [k, v] of Object.entries(patch.errors ?? {})) {
    if (v == null) delete errors[k];
    else errors[k] = v;
  }
  const next: Footage = {
    ...current,
    ...patch,
    steps: { ...current.steps, ...patch.steps },
    errors,
    id,
    file: current.file,
    updatedAt: Date.now(),
  };
  await writeJSON(PATHS.meta(id), next);
  return Response.json({ item: next });
}

/** Deletes a video: the file, its record and its thumbnails. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!validId(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  const current = await readJSON<Footage>(PATHS.meta(id));
  await remove([PATHS.meta(id), PATHS.thumbs(id), ...(current?.file.path ? [current.file.path] : [])]);
  return Response.json({ ok: true });
}
