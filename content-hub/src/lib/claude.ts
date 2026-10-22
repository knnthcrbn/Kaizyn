"use client";

import { ANTI_AI_BRIEF } from "./antiAi";
import { capability, IN_CLAUDE, type Sample } from "./platform";
import { contextBlock, SYSTEM } from "./prompt";
import { formatLabel, pillarLabel, scriptModeLabel, stageLabel } from "./meta";
import { useHub } from "./store";
import type { Usage } from "./models";

/** Everything Claude should know about where the user is and how they talk. */
export function buildContext(page: string) {
  const s = useHub.getState();
  const item = s.items.find((i) => i.id === s.openItemId) ?? null;
  return {
    page,
    antiAi: ANTI_AI_BRIEF,
    voiceProfile: s.voiceProfile,
    // Most recent samples first, capped so the request stays small.
    voiceSamples: s.voiceEntries.slice(0, 8).map((v) => v.text.slice(0, 4000)),
    stories: s.stories.map((st) => ({
      title: st.title,
      whatHappened: st.whatHappened,
      lesson: st.lesson,
      themes: st.themes,
    })),
    item: item && {
      title: item.title,
      pillar: pillarLabel(item.pillar),
      format: formatLabel(item.format),
      stage: stageLabel(item.stage),
      scriptMode: scriptModeLabel(item.scriptMode),
      hooks: item.hooks,
      chosenHook: item.hooks[item.chosenHook] ?? null,
      overlay: item.overlay,
      script: item.script,
      caption: item.caption,
      notes: item.notes,
      linkedStories: s.stories
        .filter((st) => item.storyIds.includes(st.id))
        .map((st) => st.title),
    },
  };
}

/**
 * The hub context in two parts: what rarely changes in a conversation (voice,
 * stories, rules) and what does (the screen and the open card). A chat sends
 * the first part once and the second only when it moves.
 */
export function contextParts(page: string) {
  const { item, page: where, ...rest } = buildContext(page);
  return { full: contextBlock(rest), lite: contextBlock({ page: where, item }) };
}

export interface WireAttachment {
  kind: "image" | "pdf" | "text";
  name: string;
  fileId?: string;
  text?: string;
}

export interface WireMessage {
  role: "user" | "assistant";
  text: string;
  context?: string;
  attachments?: WireAttachment[];
}

export interface ChatRequest {
  messages: WireMessage[];
  model?: string;
  effort?: string;
  web?: boolean;
}

/** Mirrors the server route's StreamEvent. */
export type ClaudeEvent =
  | { t: "model"; model: string }
  | { t: "thinking"; d: string }
  | { t: "text"; d: string }
  | { t: "search"; q: string }
  | { t: "fetch"; url: string }
  | { t: "source"; url: string; title: string }
  | { t: "note"; d: string }
  | { t: "done"; stop: string | null; model: string; usage: Usage }
  | { t: "error"; message: string };

/** Streams one Claude turn from the hub's server route, event by event. */
export async function streamChat(req: ChatRequest, onEvent: (e: ClaudeEvent) => void, signal?: AbortSignal) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status}).`;
    try {
      message = (await res.json()).error ?? message;
    } catch {}
    onEvent({ t: "error", message });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line) as ClaudeEvent);
      } catch {
        // A malformed line is skipped rather than ending the reply.
      }
    }
  }
}

/**
 * A one-off Claude call with the hub context attached (the Voice Lab's profile
 * builder). Calls onText with the full text so far and resolves with it.
 */
export async function streamClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  page: string,
  onText: (text: string) => void,
  signal?: AbortSignal,
) {
  if (IN_CLAUDE) return sampleClaude(messages, page, onText, signal);
  const { full, lite } = contextParts(page);
  let text = "";
  await streamChat(
    {
      messages: messages.map((m, i) => ({
        role: m.role,
        text: m.content,
        context: i === 0 ? [full, lite].filter(Boolean).join("\n\n") : undefined,
      })),
    },
    (e) => {
      if (e.t === "text") onText((text += e.d));
      else if (e.t === "error") onText((text += `${text ? "\n\n" : ""}⚠️ ${e.message}`));
    },
    signal,
  );
  return text;
}

const SAMPLE_ERRORS: Record<string, string> = {
  not_granted: "Claude needs your permission to run in this page. Reload and choose Allow when asked.",
  sampling_disabled: "Claude isn't available on this account.",
  rate_limited: "Too many requests right now. Give it a minute and try again.",
  session_expired: "Your claude.ai session expired. Sign in again, then retry.",
  refused: "Claude declined this one. Try rewording it.",
  prompt_too_large: "That's too much text for one request. Trim your voice samples or the card and try again.",
};

/** The claude.ai-hosted copy: ask Claude on the viewer's own account. */
export async function sampleClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  page: string,
  onText: (text: string) => void,
  signal?: AbortSignal,
) {
  const sample = await capability<Sample>("sample");
  if (!sample) {
    const msg = "⚠️ Claude isn't available in this view. Open the hub inside claude.ai to use it.";
    onText(msg);
    return msg;
  }
  // No system prompt here, so the instructions and context lead as a user turn.
  const rules = `${SYSTEM}\n\n${contextBlock(buildContext(page))}\n\nThe conversation with the creator follows. Reply to their last message.`;
  try {
    const { text, truncated } = await sample([{ role: "user", content: rules }, ...messages], {
      cache: false,
      signal,
      onText: ({ text }) => onText(text),
    });
    const final = truncated ? `${text}\n\n_(Cut off at the length limit.)_` : text;
    onText(final);
    return final;
  } catch (e) {
    const err = e as { code?: string; text?: string };
    if (err.code === "cancelled") {
      onText(err.text ?? "");
      return err.text ?? "";
    }
    const msg = `${err.text ? `${err.text}\n\n` : ""}⚠️ ${SAMPLE_ERRORS[err.code ?? ""] ?? "Something went wrong talking to Claude. Try again."}`;
    onText(msg);
    return msg;
  }
}
