import { connection } from "next/server";
import { listPrefix, readJSON, STORAGE } from "@/lib/footage/store";
import { PATHS } from "@/lib/footage/types";

/** The catalog: which records exist and when each last changed, plus the folders. */
export async function GET() {
  await connection();
  try {
    const [metas, folders] = await Promise.all([listPrefix("footage/meta/"), readJSON<string[]>(PATHS.folders)]);
    return Response.json({
      storage: STORAGE,
      folders: folders ?? [],
      items: metas
        .filter((m) => m.path.endsWith(".json"))
        .map((m) => ({ id: m.path.slice("footage/meta/".length, -".json".length), updatedAt: m.updatedAt })),
    });
  } catch (err) {
    return Response.json({ error: `Couldn't read the library: ${(err as Error).message}` }, { status: 500 });
  }
}
