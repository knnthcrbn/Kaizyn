// Small structured Claude calls for the footage library. Haiku 5.5 is the
// model: these run once per batch of frames or per search, so a cheap fast
// model matters far more than prose quality.
import Anthropic from "@anthropic-ai/sdk";

export const LIBRARY_MODEL = "claude-haiku-5-5";

export async function structured<T>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Haiku unless the job needs more judgement. */
  model?: string;
  /** Low unless the job is taste over a lot of reading (picking shorts). */
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const res = await new Anthropic().messages.create({
    model: opts.model ?? LIBRARY_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    output_config: { effort: opts.effort ?? "low", format: { type: "json_schema", schema: opts.schema } },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to describe this.");
  if (res.stop_reason === "max_tokens") throw new Error("The description was cut off.");
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No answer came back.");
  return JSON.parse(text.text) as T;
}

/** A route-friendly message for whatever went wrong. */
export function failure(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return { message: "Claude isn't connected (no valid API key).", status: 503 };
  if (err instanceof Anthropic.RateLimitError) return { message: "Claude is rate limited. Try again in a minute.", status: 429 };
  if (err instanceof Anthropic.APIError) {
    const detail = (err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message;
    return { message: `Claude API error (${err.status ?? "?"}): ${detail}`, status: 502 };
  }
  return { message: (err as Error)?.message ?? "Something went wrong.", status: 500 };
}
