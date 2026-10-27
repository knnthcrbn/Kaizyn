import { connection } from "next/server";
import { listPrefix } from "@/lib/footage/store";
import type { AssetKind } from "@/lib/studio/paths";

/** The team's uploaded fonts or music, newest first, so anyone can reuse them. */
export async function GET(req: Request) {
  await connection();
  const kind = new URL(req.url).searchParams.get("kind") as AssetKind | null;
  if (kind !== "fonts" && kind !== "audio") return Response.json({ error: "Bad kind" }, { status: 400 });
  try {
    const files = await listPrefix(`studio/${kind}/`);
    // Local storage lists one level at a time: studio/<kind>/<id>/<name>.
    const flat = (
      await Promise.all(files.map(async (f) => (/\.[\w]+$/.test(f.path) ? [f] : listPrefix(`${f.path}/`))))
    ).flat();
    return Response.json({
      files: flat
        .map((f) => ({ path: f.path, name: f.path.split("/").pop() ?? f.path, size: f.size, updatedAt: f.updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    });
  } catch (err) {
    return Response.json({ error: `Couldn't list ${kind}: ${(err as Error).message}` }, { status: 500 });
  }
}
