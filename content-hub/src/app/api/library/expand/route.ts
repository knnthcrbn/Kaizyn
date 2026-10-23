import { failure, structured } from "@/lib/footage/claude";

// Turns a search into the other ways it might have been said or shown, so
// "$1 million month" also finds "a million a month" and "1M/month".
const SYSTEM = `Expand a search over raw video footage (transcripts of what was said, and descriptions of what was on screen) into other ways the same thing might have been said or shown.
Return 4 to 10 lowercase terms of 1 to 4 words each, starting with the original. Include spoken variants ("a million a month", "1 million a month", "seven figures a month"), synonyms ("puppy" for dog), brand and model names ("tesla", "model y" for tesla), and common misspellings a transcript might contain. Never add unrelated topics.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["terms"],
  properties: { terms: { type: "array", items: { type: "string" } } },
};

export async function POST(req: Request) {
  const { q } = (await req.json().catch(() => ({}))) as { q?: string };
  const query = q?.trim().slice(0, 200);
  if (!query) return Response.json({ error: "Empty search." }, { status: 400 });
  try {
    const out = await structured<{ terms: string[] }>({
      system: SYSTEM,
      content: [{ type: "text", text: query }],
      schema: SCHEMA,
      maxTokens: 600,
    });
    const terms = [...new Set([query.toLowerCase(), ...out.terms.map((t) => t.toLowerCase().trim())])].filter(Boolean).slice(0, 12);
    return Response.json({ terms });
  } catch (err) {
    const { message, status } = failure(err);
    return Response.json({ error: message }, { status });
  }
}
