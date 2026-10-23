import { STORAGE, writeStream } from "@/lib/footage/store";
import { isFootageFile } from "@/lib/footage/types";

// Local development only: stands in for the browser-to-Blob upload.
export async function PUT(req: Request) {
  if (STORAGE !== "local") return Response.json({ error: "Not available here." }, { status: 404 });
  const p = new URL(req.url).searchParams.get("path") ?? "";
  if (!isFootageFile(p) || !req.body) return Response.json({ error: "Bad upload" }, { status: 400 });
  await writeStream(p, req.body);
  return Response.json({ ok: true });
}
