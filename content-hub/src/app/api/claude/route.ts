import Anthropic from "@anthropic-ai/sdk";
import { connection } from "next/server";

interface HubContext {
  page?: string;
  item?: Record<string, unknown> | null;
  voiceProfile?: string;
  voiceSamples?: string[];
  stories?: { title: string; whatHappened: string; lesson: string; themes: string[] }[];
  antiAi?: string;
}

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: HubContext;
}

// The stable part of the system prompt. Kept byte-identical between requests
// so it is served from the prompt cache.
const SYSTEM = `You are the writing partner built into a creator's Content Hub.

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

function contextBlock(ctx: HubContext = {}) {
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

/** Lets the Settings screen show whether a key is configured (never the key itself). */
export async function GET() {
  // Read the environment at request time, not at build time.
  await connection();
  return Response.json({
    configured: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request body." }, { status: 400 });
  }
  if (!body.messages?.length) {
    return Response.json({ error: "No messages." }, { status: 400 });
  }

  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return Response.json(
      { error: "Claude isn't connected yet. Add ANTHROPIC_API_KEY to content-hub/.env.local and restart." },
      { status: 503 },
    );
  }

  const ctx = contextBlock(body.context);
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
  ];
  if (ctx) system.push({ type: "text", text: ctx });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = client.beta.messages.stream({
          model: "claude-opus-5-5",
          max_tokens: 64000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium" },
          system,
          messages: body.messages,
        });
        for await (const event of run) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await run.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_Claude declined this one. Try rewording it._"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n_(Cut off at the length limit.)_"));
        }
      } catch (err) {
        let msg = "Something went wrong talking to Claude.";
        if (err instanceof Anthropic.AuthenticationError) {
          msg = "Claude isn't connected yet. Add ANTHROPIC_API_KEY to content-hub/.env.local and restart.";
        } else if (err instanceof Anthropic.RateLimitError) {
          msg = "Rate limited. Give it a few seconds and try again.";
        } else if (err instanceof Anthropic.APIError) {
          msg = `Claude API error ${err.status ?? ""}: ${err.message}`;
        } else if (err instanceof Error && /api[_ ]?key|credentials/i.test(err.message)) {
          msg = "Claude isn't connected yet. Add ANTHROPIC_API_KEY to content-hub/.env.local and restart.";
        }
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
