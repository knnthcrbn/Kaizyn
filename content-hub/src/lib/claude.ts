"use client";

import { ANTI_AI_BRIEF } from "./antiAi";
import { capability, IN_CLAUDE, type Sample } from "./platform";
import { contextBlock, SYSTEM } from "./prompt";
import { formatLabel, pillarLabel, scriptModeLabel, stageLabel } from "./meta";
import { useHub } from "./store";

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
 * Streams a Claude reply. Calls onText with the full text so far on every chunk
 * and resolves with the final text.
 */
export async function streamClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  page: string,
  onText: (text: string) => void,
  signal?: AbortSignal,
) {
  if (IN_CLAUDE) return sampleClaude(messages, page, onText, signal);
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context: buildContext(page) }),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status}).`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    onText(`⚠️ ${msg}`);
    return `⚠️ ${msg}`;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
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
async function sampleClaude(
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
