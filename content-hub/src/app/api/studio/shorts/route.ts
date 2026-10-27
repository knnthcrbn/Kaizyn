import { failure, structured } from "@/lib/footage/claude";

// Repurposing: Claude reads a long video's transcript and picks the moments
// that work as shorts on their own. The lines go in numbered and come back as
// line numbers, so every cut lands where the speech model heard the words,
// never on a guessed timestamp. Sonnet, because this is an editor's taste.
export const maxDuration = 300;

const LENGTHS = {
  short: { min: 15, max: 30, label: "15 to 30 seconds" },
  medium: { min: 30, max: 60, label: "30 to 60 seconds" },
  long: { min: 60, max: 90, label: "60 to 90 seconds" },
} as const;
type ShortLength = keyof typeof LENGTHS;

const SCHEMA = {
  type: "object",
  properties: {
    shorts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "integer", description: "Number of the first transcript line of the short." },
          to: { type: "integer", description: "Number of the last transcript line of the short." },
          title: { type: "string", description: "A working title for the pipeline, under 60 characters." },
          hook: { type: "string", description: "On-screen hook text for the first seconds, 3 to 10 words." },
          caption: { type: "string", description: "The post caption: one or two sentences in the speaker's voice, no hashtags." },
          why: { type: "string", description: "One sentence: why this moment works as a short." },
          score: { type: "integer", description: "1 to 10: how likely it is to hold attention and get shared." },
          pillar: { type: "string", enum: ["business", "lifestyle", "personal"] },
        },
        required: ["from", "to", "title", "hook", "caption", "why", "score", "pillar"],
        additionalProperties: false,
      },
    },
  },
  required: ["shorts"],
  additionalProperties: false,
};

const SYSTEM = `You are a short-form editor who turns long videos (podcasts, YouTube videos, talks, livestreams) into clips for Reels, TikTok and Shorts, the way clipping pages do.

Pick the moments that work as a short on their own:
- It makes sense to someone who hasn't seen the rest: no "like I said earlier", no unexplained "he" or "that".
- The first line hooks: a bold claim, a number, a question, a confession, a contrarian take, the start of a story. If the strongest hook comes a line or two in, start there.
- It pays off: a lesson, a punchline, a result, a turn. End on the payoff, not trailing into the next topic.
- Prefer specific stories, numbers and opinions over generic advice.

Rules:
- Use the line numbers exactly as given. A short runs from the start of line "from" to the end of line "to".
- Keep each short inside the length asked for (the times are shown on each line).
- Shorts must not overlap. Spread them across the whole video rather than bunching at the start.
- The hook is text on screen, not a quote of the first line: it makes someone stop scrolling ("He lost $40k on one ad", "Nobody tells you this about hiring").
- Write titles, hooks and captions in the speaker's own voice and plain words.
- Score honestly; most moments are a 5 to 7. Return them best first.
- Fewer is fine: never pad with weak moments to reach the number asked for.

Pillars: business (Meta ads, marketing, sales, leadership, running the agency), lifestyle (B-roll with text people relate to and repost), personal (life lessons, the accident, relationship, real talk).`;

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

interface Line {
  i: number;
  start: number;
  end: number;
  text: string;
}
interface Pick {
  from: number;
  to: number;
  title: string;
  hook: string;
  caption: string;
  why: string;
  score: number;
  pillar: "business" | "lifestyle" | "personal";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    lines?: Line[];
    length?: ShortLength;
    count?: number;
    voice?: string;
  } | null;
  const lines = body?.lines
    ?.filter((l) => Number.isInteger(l.i) && typeof l.text === "string" && Number.isFinite(l.start) && Number.isFinite(l.end))
    .slice(0, 6000);
  if (!lines?.length) return Response.json({ error: "This video has no transcript to read yet." }, { status: 400 });
  const length = LENGTHS[body?.length ?? "medium"] ?? LENGTHS.medium;
  const count = Math.min(30, Math.max(1, Math.round(body?.count ?? 10)));
  const voice = body?.voice?.trim().slice(0, 2000);
  const transcript = lines.map((l) => `${l.i} [${mmss(l.start)}] ${l.text.trim()}`).join("\n");

  try {
    const out = await structured<{ shorts: Pick[] }>({
      model: "claude-sonnet-5-5",
      effort: "medium",
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 16000,
      content: [
        {
          type: "text",
          text:
            `Video: "${body?.name ?? "Untitled"}", ${mmss(lines[lines.length - 1].end)} long.\n` +
            `Find up to ${count} shorts, each ${length.label}.\n` +
            (voice ? `\nHow the speaker talks (for titles, hooks and captions):\n${voice}\n` : "") +
            `\nTranscript, one numbered line each with its start time:\n${transcript}`,
        },
      ],
    });

    // Line numbers to times; anything outside the transcript, far off the
    // length asked for, or overlapping a better pick is dropped.
    const byIndex = new Map(lines.map((l) => [l.i, l]));
    const kept: (Pick & { start: number; end: number })[] = [];
    for (const p of [...out.shorts].sort((a, b) => b.score - a.score)) {
      const a = byIndex.get(p.from);
      const b = byIndex.get(Math.max(p.from, p.to));
      if (!a || !b) continue;
      const span = b.end - a.start;
      if (span < length.min * 0.5 || span > length.max * 1.6) continue;
      if (kept.some((k) => a.start < k.end && b.end > k.start)) continue;
      kept.push({ ...p, to: Math.max(p.from, p.to), score: Math.min(10, Math.max(1, p.score)), start: a.start, end: b.end });
      if (kept.length >= count) break;
    }
    return Response.json({ shorts: kept });
  } catch (err) {
    const f = failure(err);
    return Response.json({ error: f.message }, { status: f.status });
  }
}
