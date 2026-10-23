import { connection } from "next/server";
import { readJSON, writeJSON } from "@/lib/footage/store";
import { PATHS, type FootageThumbs } from "@/lib/footage/types";

const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{6,40}$/.test(id);

export async function GET(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("id");
  if (!validId(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  return Response.json({ thumbs: (await readJSON<FootageThumbs>(PATHS.thumbs(id))) ?? {} });
}

export async function PUT(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const thumbs = (await req.json().catch(() => null)) as FootageThumbs | null;
  if (!validId(id) || !thumbs) return Response.json({ error: "Bad thumbnails" }, { status: 400 });
  await writeJSON(PATHS.thumbs(id), thumbs);
  return Response.json({ ok: true });
}
