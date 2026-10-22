import Anthropic from "@anthropic-ai/sdk";
import { connection } from "next/server";
import { SYSTEM, contextBlock, type HubContext } from "@/lib/prompt";

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: HubContext;
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
