import Anthropic from "@anthropic-ai/sdk";
import { apiDetail } from "@/lib/apiError";

// Attachments go to Anthropic's Files API once and are sent by id afterwards,
// so a picture in turn 2 doesn't ride along in every later request body.

const TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
// Vercel caps a function's request body at 4.5 MB.
const MAX_BYTES = 4.4 * 1024 * 1024;

export async function POST(req: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "Bad upload." }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "No file." }, { status: 400 });
  if (!TYPES.has(file.type)) {
    return Response.json({ error: "Images (JPG, PNG, GIF, WebP) and PDFs only." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That file is over 4.4 MB. Try a smaller one." }, { status: 413 });
  }

  try {
    const meta = await new Anthropic().files.upload({ file });
    return Response.json({ id: meta.id });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Claude isn't connected yet, so files can't be attached." }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Upload failed (${err.status ?? "?"}): ${apiDetail(err)}` }, { status: 502 });
    }
    const missingKey = err instanceof Error && /api[_ ]?key|credentials/i.test(err.message);
    return Response.json(
      { error: missingKey ? "Claude isn't connected yet, so files can't be attached." : "Upload failed." },
      { status: missingKey ? 503 : 500 },
    );
  }
}
