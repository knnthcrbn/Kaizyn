import { failure, structured } from "@/lib/footage/claude";

// Caption variants for posting one video to many accounts: clipping pages
// that all post the same caption look like a network (and get treated like
// one), so each gets its own wording. Sonnet, because the captions have to
// sound like the creator, not like a template with the words shuffled.
export const maxDuration = 120;

const PLATFORM_RULES: Record<string, string> = {
  instagram: "Instagram: 1 to 3 short lines, a reason to comment or share, then 3 to 5 hashtags on the last line.",
  tiktok: "TikTok: one short line (under 150 characters) plus 3 to 5 hashtags.",
  youtube: "YouTube Shorts: a title-style line under 90 characters, then 2 or 3 hashtags.",
  facebook: "Facebook: 1 or 2 plain sentences, at most 2 hashtags.",
  linkedin: "LinkedIn: 2 to 4 short sentences, professional but in their voice, at most 3 hashtags.",
  x: "X: one line under 240 characters, at most 1 hashtag.",
  threads: "Threads: one or two conversational lines, no hashtags.",
};

const SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: { platform: { type: "string" }, caption: { type: "string" } },
        required: ["platform", "caption"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
};

const SYSTEM = `You write social captions for a creator who posts the same video to many accounts (their main profiles and clipping pages). Each account needs its own caption so no two pages look copy-pasted.

- Every variant says the same thing about the same video, but with a different opening, wording and hashtags. Vary the angle: a question, a bold line, a quote from the video, a relatable take.
- Sound like the creator talking: plain words, contractions, no corporate phrasing. Never use "game-changer", "unlock", "dive in", "in today's world", "here's the thing", em dashes, or a neat moral at the end.
- Don't invent facts, numbers or claims that aren't in what you're given.
- Follow each platform's rule for length and hashtags.`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    hook?: string;
    caption?: string;
    script?: string;
    voice?: string;
    platforms?: { platform: string; count: number }[];
  } | null;
  const platforms = (body?.platforms ?? [])
    .filter((p) => PLATFORM_RULES[p.platform] && p.count > 0)
    .map((p) => ({ platform: p.platform, count: Math.min(25, Math.round(p.count)) }));
  if (!platforms.length) return Response.json({ error: "Pick at least one account to write captions for." }, { status: 400 });
  const about = [
    body?.title && `Video: ${body.title}`,
    body?.hook && `Hook: ${body.hook}`,
    body?.caption?.trim() && `Their own caption for it:\n${body.caption.trim()}`,
    body?.script?.trim() && `What's said (excerpt):\n${body.script.trim().slice(0, 2500)}`,
    body?.voice?.trim() && `How they talk:\n${body.voice.trim().slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    const out = await structured<{ variants: { platform: string; caption: string }[] }>({
      model: "claude-sonnet-5-5",
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 12000,
      content: [
        {
          type: "text",
          text:
            `${about || "No details given; keep it general."}\n\n` +
            `Write these caption variants (use the platform names exactly as given):\n` +
            platforms.map((p) => `- ${p.count} for ${p.platform}. ${PLATFORM_RULES[p.platform]}`).join("\n"),
        },
      ],
    });
    const wanted = new Set(platforms.map((p) => p.platform));
    return Response.json({ variants: out.variants.filter((v) => wanted.has(v.platform) && v.caption.trim()) });
  } catch (err) {
    const f = failure(err);
    return Response.json({ error: f.message }, { status: f.status });
  }
}
