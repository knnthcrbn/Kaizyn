import Anthropic from "@anthropic-ai/sdk";
import { connection } from "next/server";
import { SYSTEM } from "@/lib/prompt";
import { apiDetail } from "@/lib/apiError";
import { DEFAULT_EFFORT, DEFAULT_MODEL, isEffort, isModel, modelInfo, type ModelInfo } from "@/lib/models";

// Opus at high effort with a few web searches can run for minutes.
export const maxDuration = 300;

interface WireAttachment {
  kind: "image" | "pdf" | "text";
  name: string;
  fileId?: string;
  text?: string;
}

interface WireMessage {
  role: "user" | "assistant";
  text: string;
  context?: string;
  attachments?: WireAttachment[];
}

interface Body {
  messages: WireMessage[];
  model?: string;
  effort?: string;
  web?: boolean;
  /** The viewer's time zone, so "today" means their today. */
  tz?: string;
}

/** One line of the stream the client reads (newline-delimited JSON). */
type StreamEvent =
  | { t: "model"; model: string }
  | { t: "thinking"; d: string }
  | { t: "text"; d: string }
  | { t: "search"; q: string }
  | { t: "fetch"; url: string }
  | { t: "source"; url: string; title: string }
  | { t: "note"; d: string }
  | {
      t: "done";
      stop: string | null;
      model: string;
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number; searches: number };
    }
  | { t: "error"; message: string };

const NOT_CONNECTED = process.env.VERCEL
  ? "Claude isn't connected yet. Add ANTHROPIC_API_KEY in Vercel (content-hub → Settings → Environment Variables), then redeploy."
  : "Claude isn't connected yet. Add ANTHROPIC_API_KEY to content-hub/.env.local and restart.";

// A pause_turn hands the turn back mid-search; this many resumes is plenty.
const MAX_CONTINUATIONS = 5;

/** Lets the Settings screen show whether a key is configured (never the key itself). */
export async function GET() {
  // Read the environment at request time, not at build time.
  await connection();
  return Response.json({
    configured: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    host: process.env.VERCEL ? "vercel" : "local",
  });
}

function userBlocks(m: WireMessage): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (m.context) blocks.push({ type: "text", text: `<hub_context>\n${m.context}\n</hub_context>` });
  for (const a of m.attachments ?? []) {
    if (a.kind === "image" && a.fileId) {
      blocks.push({ type: "image", source: { type: "file", file_id: a.fileId } });
    } else if (a.kind === "pdf" && a.fileId) {
      blocks.push({ type: "document", source: { type: "file", file_id: a.fileId }, title: a.name });
    } else if (a.kind === "text" && a.text != null) {
      blocks.push({ type: "text", text: `<file name="${a.name.replace(/"/g, "'")}">\n${a.text}\n</file>` });
    }
  }
  blocks.push({ type: "text", text: m.text.trim() || "(See the attached files.)" });
  return blocks;
}

function webTools(model: ModelInfo): Anthropic.Beta.BetaToolUnion[] {
  return model.dynamicWeb
    ? [
        { type: "web_search_20260209", name: "web_search", max_uses: 8 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
      ]
    : [
        { type: "web_search_20250305", name: "web_search", max_uses: 5 },
        { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3 },
      ];
}

function today(tz?: string) {
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  try {
    return new Date().toLocaleDateString("en-US", { ...opts, timeZone: tz });
  } catch {
    return new Date().toLocaleDateString("en-US", opts);
  }
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
    return Response.json({ error: NOT_CONNECTED }, { status: 503 });
  }

  const model = modelInfo(isModel(body.model) ? body.model : DEFAULT_MODEL);
  const effort = isEffort(body.effort) ? body.effort : DEFAULT_EFFORT;

  // Earlier turns go back as text only. Replaying thinking blocks would tie the
  // conversation to an exact history (and 400 if anything in it changed); a
  // chat app gains little from them, and text alone caches just as well.
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of body.messages) {
    if (m.role === "user") messages.push({ role: "user", content: userBlocks(m) });
    else if (m.text.trim()) messages.push({ role: "assistant", content: m.text });
  }
  if (messages[0]?.role !== "user" || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "The conversation has to start and end with your message." }, { status: 400 });
  }

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: `Today is ${today(body.tz)}.` },
  ];
  let tools = body.web ? webTools(model) : [];

  const encoder = new TextEncoder();
  let run: ReturnType<typeof client.beta.messages.stream> | null = null;
  let cancelled = false;
  // Stop paying for tokens nobody will read.
  req.signal.addEventListener("abort", () => {
    cancelled = true;
    run?.abort();
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      };
      const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };
      let lastModel: string = model.id;
      let stop: string | null = null;
      let streamedAnything = false;
      let droppedWeb = false;

      try {
        for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
          run = client.beta.messages.stream({
            model: model.id,
            max_tokens: 64000,
            ...(model.fallbacks
              ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
              : {}),
            thinking: { type: "adaptive", display: "summarized" },
            output_config: { effort },
            cache_control: { type: "ephemeral" },
            system,
            ...(tools.length ? { tools } : {}),
            messages,
          });

          try {
            for await (const event of run) {
              if (event.type === "message_start") {
                lastModel = event.message.model;
                send({ t: "model", model: lastModel });
              } else if (event.type === "content_block_delta") {
                const d = event.delta;
                if (d.type === "text_delta") {
                  streamedAnything = true;
                  send({ t: "text", d: d.text });
                } else if (d.type === "thinking_delta") {
                  streamedAnything = true;
                  send({ t: "thinking", d: d.thinking });
                } else if (d.type === "citations_delta" && d.citation.type === "web_search_result_location") {
                  send({ t: "source", url: d.citation.url, title: d.citation.title ?? d.citation.url });
                }
              } else if (event.type === "content_block_stop") {
                // The query only exists once the tool call's input has finished streaming.
                const block = run.currentMessage?.content[event.index];
                if (block?.type === "server_tool_use") {
                  const input = block.input as { query?: string; url?: string };
                  if (block.name === "web_search" && input.query) send({ t: "search", q: input.query });
                  if (block.name === "web_fetch" && input.url) send({ t: "fetch", url: input.url });
                }
              }
            }
          } catch (err) {
            // A model that doesn't take the web tools says so with a 400 before
            // writing anything; answer without them rather than fail.
            if (err instanceof Anthropic.BadRequestError && tools.length && !streamedAnything) {
              tools = [];
              droppedWeb = true;
              turn--;
              continue;
            }
            throw err;
          }

          const final = await run.finalMessage();
          lastModel = final.model;
          stop = final.stop_reason;
          const u = final.usage;
          usage.input += u.input_tokens;
          usage.output += u.output_tokens;
          usage.cacheRead += u.cache_read_input_tokens ?? 0;
          usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
          usage.searches += u.server_tool_use?.web_search_requests ?? 0;

          if (stop !== "pause_turn") break;
          // Hand the paused turn back unchanged and the server picks up where it stopped.
          messages.push({ role: "assistant", content: final.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
        }

        if (droppedWeb) send({ t: "note", d: `Web search isn't available on ${model.label}, so this answer doesn't use it.` });
        if (stop === "refusal") send({ t: "text", d: "\n\n_Claude declined this one. Try rewording it._" });
        else if (stop === "max_tokens") send({ t: "text", d: "\n\n_(Cut off at the length limit.)_" });
        send({ t: "done", stop, model: lastModel, usage });
      } catch (err) {
        if (!cancelled) {
          let message = "Something went wrong talking to Claude.";
          if (err instanceof Anthropic.AuthenticationError) message = NOT_CONNECTED;
          else if (err instanceof Anthropic.PermissionDeniedError) message = "This API key isn't allowed to use that model.";
          else if (err instanceof Anthropic.RateLimitError) message = "Rate limited. Give it a few seconds and try again.";
          else if (err instanceof Anthropic.APIError) message = `Claude API error (${err.status ?? "?"}): ${apiDetail(err)}`;
          else if (err instanceof Error && /api[_ ]?key|credentials/i.test(err.message)) message = NOT_CONNECTED;
          send({ t: "error", message });
        }
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      run?.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
