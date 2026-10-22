"use client";

import { useEffect, useRef } from "react";
import { CornerDownRight, Sparkles } from "lucide-react";
import { sendMessage, useChats, useLive } from "@/lib/chats";
import { scriptModeLabel } from "@/lib/meta";
import { useHub } from "@/lib/store";
import { cx } from "../ui";
import { Composer } from "./Composer";
import { Thread } from "./Thread";

/** The active chat and its composer. Used full screen at /chat and in the side panel. */
export function ChatView({ page, compact }: { page: string; compact?: boolean }) {
  const chatId = useChats((s) => s.activeId);
  const chat = useChats((s) => s.chats.find((c) => c.id === s.activeId) ?? null);
  const streamingId = useChats((s) => (s.activeId ? s.streaming[s.activeId] : undefined));
  const liveLen = useLive((s) => (streamingId ? (s[streamingId]?.text.length ?? 0) + (s[streamingId]?.thinking.length ?? 0) : 0));
  const count = chat?.messages.length ?? 0;
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Follow the reply as it streams, unless the reader has scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight });
  }, [count, liveLen]);

  // Opening a different chat starts at its end.
  useEffect(() => {
    pinned.current = true;
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [chatId]);

  const empty = !chat || chat.messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className={cx(compact ? "px-4 py-4" : "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10")}>
          {empty ? <Start page={page} compact={compact} chatId={chatId} /> : <Thread chatId={chat.id} page={page} />}
        </div>
      </div>
      <div className={cx(compact ? "p-3" : "mx-auto w-full max-w-3xl px-3 pb-3 sm:px-6 sm:pb-5")}>
        <Composer chatId={chatId} page={page} compact={compact} autoFocus={!compact} />
        {!compact && (
          <p className="mt-2 text-center text-[11px] text-ghost">
            Claude can make mistakes. Check anything that matters.
          </p>
        )}
      </div>
    </div>
  );
}

function Start({ page, compact, chatId }: { page: string; compact?: boolean; chatId: string | null }) {
  const item = useHub((s) => s.items.find((i) => i.id === s.openItemId));
  const voiceCount = useHub((s) => s.voiceEntries.length);
  const hub = useChats((s) => (s.chats.find((c) => c.id === chatId) ?? s.defaults).hub);

  const ideas = item
    ? [
        `Write the ${scriptModeLabel(item.scriptMode).toLowerCase()} script for this card in my voice.`,
        "Give me 5 more hooks for this card. Different hook types. One per line.",
        "Give me 5 on-screen overlay text options for this to test as trial reels. One per line.",
        "Write the caption for this post. Short, sounds like me, ends with a reason to comment or share.",
      ]
    : [
        "I'm blank. Give me 10 video ideas across all three pillars with a hook each.",
        "What's changed with Instagram Reels and trial reels in the last month?",
        "Interview me so we can write a story video. One question at a time.",
        "What should I record this week? Keep it to 3.",
      ];

  return (
    <div className={cx("fade-in", !compact && "pt-[8vh]")}>
      {!compact && (
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-2xl bg-brand/10 ring-1 ring-inset ring-brand/25">
            <Sparkles className="size-5 text-brand" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">What are we working on?</h1>
          <p className="mt-2 text-[13px] text-muted">
            Anything you&apos;d ask Claude. It can search the web and read files
            {hub ? `, and it knows your voice (${voiceCount} sample${voiceCount === 1 ? "" : "s"}) and stories` : ""}.
          </p>
        </div>
      )}
      {compact && (
        <p className="text-[13px] leading-relaxed text-muted">
          {hub
            ? `Writes in your voice using ${voiceCount} voice sample${voiceCount === 1 ? "" : "s"}, your story bank${item ? " and this card" : ""}. Ask it anything else too.`
            : "Hub context is off, so this is plain Claude."}
        </p>
      )}
      <div className={cx("text-[11px] font-medium text-ghost", compact ? "mt-4" : "mx-auto max-w-xl")}>Try</div>
      <div
        className={cx(
          "mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line",
          !compact && "mx-auto max-w-xl",
        )}
      >
        {ideas.map((q) => (
          <button
            key={q}
            onClick={() => void sendMessage(chatId, q, [], page)}
            className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-ghost" />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
