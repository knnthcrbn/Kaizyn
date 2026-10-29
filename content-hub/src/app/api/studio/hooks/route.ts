import { failure, structured } from "@/lib/footage/claude";
import { HOOK_TYPES } from "@/lib/hookTypes";

// Other lines to put on screen for the same video, to post as trial reels
// against each other. Each one takes a different angle (a hook type), so a
// test says which kind of opening works, not which of five near-copies won.
// Sonnet: the lines have to sound like the creator and stay true to the video.
export const maxDuration = 120;

const SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          type: { type: "string", enum: HOOK_TYPES.map((h) => h.id) },
        },
        required: ["text", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["lines"],
  additionalProperties: false,
};

const SYSTEM = `You write the banner text that sits on screen at the top of a short vertical video (Instagram Reels, TikTok). It's read in the first second, before anyone hears a word, and it decides whether they keep watching. The creator will post the same video several times as trial reels, each with a different banner, to see which one wins.

- Each line takes a different angle. Use a different hook type for each one, from this list: ${HOOK_TYPES.map((h) => `${h.id} (${h.name})`).join(", ")}.
- Short: 4 to 10 words is ideal, never more than 70 characters. One line of thought, no hashtags.
- True to the video: only promise what's said in it. No numbers, results or claims that aren't in what you're given.
- Sound like the creator: plain words, contractions. Never "game-changer", "unlock", "secret sauce", "you won't believe", em dashes, or emojis unless their own line uses them.
- Match how their current line is written (capitals, punctuation) so the only thing that changes is the words.
- Don't repeat or lightly reword the lines they already have.`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    hook?: string;
    subhead?: string;
    have?: string[];
    title?: string;
    script?: string;
    spoken?: string;
    voice?: string;
    count?: number;
  } | null;
  const count = Math.min(9, Math.max(1, Math.round(body?.count ?? 4)));
  const have = (body?.have ?? []).filter((x) => typeof x === "string" && x.trim()).slice(0, 12);
  const about = [
    body?.title?.trim() && `Video: ${body.title.trim()}`,
    body?.hook?.trim() && `Their banner now: ${body.hook.trim()}`,
    body?.subhead?.trim() && `The line under it (stays the same in every version): ${body.subhead.trim()}`,
    have.length > 0 && `Lines they already have (write different ones):\n${have.map((h) => `- ${h}`).join("\n")}`,
    body?.spoken?.trim() && `What's said in the video:\n${body.spoken.trim().slice(0, 3000)}`,
    body?.script?.trim() && !body?.spoken?.trim() && `The script:\n${body.script.trim().slice(0, 3000)}`,
    body?.voice?.trim() && `How they talk:\n${body.voice.trim().slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!body?.hook?.trim() && !body?.spoken?.trim() && !body?.script?.trim()) {
    return Response.json({ error: "Write the first line, or add a clip with speech, so Claude knows what the video says." }, { status: 400 });
  }
  try {
    const out = await structured<{ lines: { text: string; type: string }[] }>({
      model: "claude-sonnet-5-5",
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 6000,
      content: [{ type: "text", text: `${about}\n\nWrite ${count} new banner lines, each a different hook type.` }],
    });
    const seen = new Set(have.map((h) => h.trim().toLowerCase()));
    const lines = out.lines
      .map((l) => ({ text: l.text.trim().replace(/\s+/g, " ").slice(0, 90), type: l.type }))
      .filter((l) => l.text && !seen.has(l.text.toLowerCase()) && (seen.add(l.text.toLowerCase()), true))
      .slice(0, count);
    return Response.json({ lines });
  } catch (err) {
    const f = failure(err);
    return Response.json({ error: f.message }, { status: f.status });
  }
}
