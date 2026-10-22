"use client";

import { ANTI_AI_BRIEF } from "./antiAi";
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
