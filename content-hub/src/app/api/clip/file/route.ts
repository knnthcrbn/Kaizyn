import { connection } from "next/server";
import { clipperFor } from "@/lib/clipServer";
import { serveFile } from "@/lib/footage/store";
import { PATHS, type Footage } from "@/lib/footage/types";
import { readJSON } from "@/lib/footage/store";

// A live clip's video, for a clipper to watch or download. Only clips that
// are live, and only with a working key (in the link, since a video tag
// can't send headers).
export const maxDuration = 300;

export async function GET(req: Request) {
  await connection();
  const found = await clipperFor(req);
  if (found instanceof Response) return found;
  const q = new URL(req.url).searchParams;
  const drop = found.doc.drops.find((d) => d.id === q.get("drop") && d.status === "live");
  if (!drop?.footageId) return new Response("Not found", { status: 404 });
  const f = await readJSON<Footage>(PATHS.meta(drop.footageId));
  if (!f?.uploaded) return new Response("Not found", { status: 404 });
  const res = await serveFile(f.file.path, req.headers.get("range"), f.file.type || undefined);
  if (q.get("download")) res.headers.set("Content-Disposition", `attachment; filename="${f.file.name.replace(/[^\w.\- ]+/g, "_")}"`);
  return res;
}
