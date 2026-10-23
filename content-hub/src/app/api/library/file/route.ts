import { connection } from "next/server";
import { serveFile } from "@/lib/footage/store";
import { isFootageFile } from "@/lib/footage/types";

// Streams a stored video (with Range) to the signed-in browser. The store is
// private, so this is the only way to watch or process a file.
export const maxDuration = 300;

export async function GET(req: Request) {
  await connection();
  const p = new URL(req.url).searchParams.get("path") ?? "";
  if (!isFootageFile(p)) return new Response("Bad path", { status: 400 });
  try {
    return await serveFile(p, req.headers.get("range"));
  } catch (err) {
    return new Response(`Couldn't read the file: ${(err as Error).message}`, { status: 502 });
  }
}
