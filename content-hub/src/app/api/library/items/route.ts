import { readJSON } from "@/lib/footage/store";
import { PATHS, type Footage } from "@/lib/footage/types";

/** Full records for the given ids (the browser caches them by updatedAt). */
export async function POST(req: Request) {
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(ids)) return Response.json({ error: "ids required" }, { status: 400 });
  const items: Footage[] = [];
  // A few at a time so a big library doesn't open hundreds of connections at once.
  for (let i = 0; i < ids.length; i += 24) {
    const batch = await Promise.all(ids.slice(i, i + 24).map((id) => readJSON<Footage>(PATHS.meta(id))));
    for (const f of batch) if (f) items.push(f);
  }
  return Response.json({ items });
}
