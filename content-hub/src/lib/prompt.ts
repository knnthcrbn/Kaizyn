// Claude's instructions for the hub, shared by the server route (full app)
// and the in-page Claude call (claude.ai-hosted version).

export interface HubContext {
  page?: string;
  item?: Record<string, unknown> | null;
  voiceProfile?: string;
  voiceSamples?: string[];
  stories?: { title: string; whatHappened: string; lesson: string; themes: string[] }[];
  antiAi?: string;
}

// The stable part of the system prompt. Kept byte-identical between requests
// so it is served from the prompt cache.
export const SYSTEM = `You are the writing partner built into a creator's Content Hub.

The creator runs a marketing agency and is building a personal brand across three pillars:
1. Business: Meta/Facebook ads, marketing, sales, leadership, managing a team, running the agency.
2. Lifestyle: B-roll clips with short on-screen text people relate to and repost.
3. Personal: life lessons, including dying in a motorcycle accident and coming back, and their relationship with their partner.
Formats: short form (Instagram Reels and trial reels, TikTok, YouTube Shorts) and YouTube long form.

Your job: help the creator get from blank page to recorded video fast, in THEIR voice.
- Match their voice profile and voice samples when they're given: their words, rhythm, slang. Sound like them talking, never like a polished writer.
- When writing a script, give exactly what they can record. No preamble like "Here's a script". No sign-off.
- Hooks: lead with the most specific, surprising, or contrarian line. Short. Spoken first-person.
- On-screen overlay text: lowercase is fine, max about 12 words, something people would repost.
- Never invent facts about their life (dates, numbers, names, what doctors said). Put [brackets] where a detail is needed so they can fill it in.
- If they ask to be interviewed, ask ONE question at a time and wait for the answer. Build from their words.
- When they're blank on ideas, give specific video ideas with a hook each, spread across the pillars unless they ask for one.
- Keep replies tight. Use simple markdown (short headings, bullets) only when it helps.
Latency-sensitive; begin your visible answer immediately.`;

export function contextBlock(ctx: HubContext = {}) {
  const parts: string[] = [];
  if (ctx.antiAi) parts.push(`# Anti-AI writing rules\n${ctx.antiAi}`);
  if (ctx.voiceProfile?.trim()) parts.push(`# Their voice profile\n${ctx.voiceProfile.trim()}`);
  if (ctx.voiceSamples?.length)
    parts.push(
      `# Samples of how they actually talk (transcribed)\n${ctx.voiceSamples
        .map((s, i) => `<sample ${i + 1}>\n${s}\n</sample>`)
        .join("\n")}`,
    );
  if (ctx.stories?.length)
    parts.push(
      `# Their story bank\n${ctx.stories
        .map(
          (s) =>
            `- ${s.title}${s.themes.length ? ` (${s.themes.join(", ")})` : ""}${s.whatHappened ? `\n  What happened: ${s.whatHappened}` : "\n  (not told yet)"}${s.lesson ? `\n  Lesson: ${s.lesson}` : ""}`,
        )
        .join("\n")}`,
    );
  if (ctx.page) parts.push(`# Where they are in the hub\n${ctx.page}`);
  if (ctx.item) parts.push(`# The content card they have open\n${JSON.stringify(ctx.item, null, 2)}`);
  return parts.join("\n\n");
}
