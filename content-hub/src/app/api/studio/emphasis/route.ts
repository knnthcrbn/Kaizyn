import { failure, structured } from "@/lib/footage/claude";

// AI zoom: Claude reads what's said and picks the lines an editor would punch
// in on. Sonnet, because this is taste, not description. The words go in
// numbered, and the answer comes back as word numbers, so its timing is the
// speech model's, never a guess.
export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  properties: {
    moments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "integer", description: "Index of the first word of the moment." },
          to: { type: "integer", description: "Index of the last word of the moment." },
          strength: { type: "string", enum: ["punch", "strong"] },
          why: { type: "string" },
        },
        required: ["from", "to", "strength", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["moments"],
  additionalProperties: false,
};

const SYSTEM = `You edit talking-head videos for social media. You choose where the picture punches in (a quick zoom) to land a line, the way a professional short-form editor does in CapCut.

Punch in on: the hook in the first seconds, a bold claim, a number or result, the turn in a story, a punchline, a strong emotion, a contrast ("not X, but Y"), a direct call to the viewer.
Don't punch in on filler, setup or every sentence. Variety matters: if everything is emphasised, nothing is.

Rules:
- Each moment is a short phrase, usually 2 to 8 words, never more than about 3 seconds.
- Leave space: no two moments closer than about 3 seconds apart in a short, about 8 seconds in a long video.
- "strong" is for the 1 to 3 biggest lines; everything else is "punch".
- Use the word numbers exactly as given.`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { words?: { i: number; w: string; t: number }[]; long?: boolean } | null;
  const words = body?.words?.filter((x) => Number.isInteger(x.i) && typeof x.w === "string").slice(0, 6000);
  if (!words?.length) return Response.json({ error: "No words to read. Make captions first." }, { status: 400 });
  const text = words.map((x) => `${x.i}:${x.w}`).join(" ");
  const seconds = Math.round(words[words.length - 1].t);
  try {
    const out = await structured<{ moments: { from: number; to: number; strength: "punch" | "strong"; why: string }[] }>({
      model: "claude-sonnet-5-5",
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 4000,
      content: [
        {
          type: "text",
          text: `A ${body?.long ? "long YouTube" : "short"} video, ${seconds} seconds. Each word is "number:word".\n\n${text}`,
        },
      ],
    });
    const max = words[words.length - 1].i;
    // A moment that runs past the last word ends on it, rather than being lost.
    const moments = out.moments
      .map((m) => ({ ...m, to: Math.min(m.to, max) }))
      .filter((m) => m.from >= 0 && m.from <= max && m.to >= m.from)
      .sort((a, b) => a.from - b.from);
    return Response.json({ moments });
  } catch (err) {
    const f = failure(err);
    return Response.json({ error: f.message }, { status: f.status });
  }
}
