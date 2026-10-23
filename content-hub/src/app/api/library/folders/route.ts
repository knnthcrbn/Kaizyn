import { writeJSON } from "@/lib/footage/store";
import { PATHS } from "@/lib/footage/types";

/** Saves the folder list (folders with videos in them also come from the records). */
export async function PUT(req: Request) {
  const { folders } = (await req.json().catch(() => ({}))) as { folders?: unknown };
  if (!Array.isArray(folders) || folders.some((f) => typeof f !== "string")) {
    return Response.json({ error: "Bad folders" }, { status: 400 });
  }
  const clean = [...new Set((folders as string[]).map((f) => f.trim().replace(/\/+/g, "/").replace(/^\/|\/$/g, "")))]
    .filter(Boolean)
    .slice(0, 500);
  await writeJSON(PATHS.folders, clean);
  return Response.json({ folders: clean });
}
