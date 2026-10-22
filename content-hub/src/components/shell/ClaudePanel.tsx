"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  Check,
  Copy,
  FileText,
  ListPlus,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useHub, uid } from "@/lib/store";
import { streamClaude } from "@/lib/claude";
import { useSpeech } from "@/lib/useSpeech";
import { ALL_NAV } from "@/lib/nav";
import { scriptModeLabel } from "@/lib/meta";
import { extractLines, Markdown } from "../Markdown";
import { cx } from "../ui";

function pageName(pathname: string) {
  const n = ALL_NAV.find((x) => (x.href === "/" ? pathname === "/" : pathname.startsWith(x.href)));
  return n ? `${n.label} screen` : pathname;
}

export function ClaudePanel() {
  const pathname = usePathname();
  const open = useHub((s) => s.claudeOpen);
  const setOpen = useHub((s) => s.setClaudeOpen);
  const chat = useHub((s) => s.chat);
  const pushChat = useHub((s) => s.pushChat);
  const patchChat = useHub((s) => s.patchChat);
  const clearChat = useHub((s) => s.clearChat);
  const openItemId = useHub((s) => s.openItemId);
  const item = useHub((s) => s.items.find((i) => i.id === s.openItemId));
  const updateItem = useHub((s) => s.updateItem);
  const voiceCount = useHub((s) => s.voiceEntries.length);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const speech = useSpeech((said) => setInput((v) => (v ? `${v} ${said}` : said)));
  const busyRef = useRef(false);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      const history = useHub.getState().chat;
      const userMsg = { id: uid(), role: "user" as const, content };
      const reply = { id: uid(), role: "assistant" as const, content: "" };
      pushChat(userMsg);
      pushChat(reply);
      setInput("");
      setBusy(true);
      busyRef.current = true;
      abort.current = new AbortController();
      try {
        await streamClaude(
          [...history, userMsg]
            .filter((m) => m.content.trim())
            .map(({ role, content }) => ({ role, content })),
          pageName(pathname),
          (t) => patchChat(reply.id, t),
          abort.current.signal,
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") patchChat(reply.id, "⚠️ Couldn't reach the hub's server.");
      } finally {
        setBusy(false);
        busyRef.current = false;
        abort.current = null;
        // A question may have been queued from elsewhere while this one ran.
        const next = useHub.getState().takePendingPrompt();
        if (next) setTimeout(() => sendRef.current(next), 0);
      }
    },
    [busy, pathname, patchChat, pushChat],
  );

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  // Something elsewhere in the hub asked Claude a question.
  useEffect(
    () =>
      useHub.subscribe((s) => {
        if (s.claudeOpen && s.pendingPrompt && !busyRef.current) {
          const p = s.takePendingPrompt();
          if (p) void sendRef.current(p);
        }
      }),
    [],
  );

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [chat]);

  if (!open) return null;

  const quick = item
    ? [
        `Write the ${scriptModeLabel(item.scriptMode).toLowerCase()} script for this card in my voice.`,
        "Give me 5 more hooks for this card. Different hook types. One per line.",
        "Give me 5 on-screen overlay text options for this to test as trial reels. One per line.",
        "Write the caption for this post. Short, sounds like me, ends with a reason to comment or share.",
        "Read my script back and make it sound more like me and less like AI.",
      ]
    : [
        "I'm blank. Give me 10 video ideas across all three pillars with a hook each.",
        "Interview me so we can write a story video. One question at a time.",
        "Give me 5 lifestyle overlay lines people would want to repost.",
        "What should I record this week? Keep it to 3.",
      ];

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <aside className="slide-in-right fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-line bg-surface/95 backdrop-blur-xl lg:static lg:z-auto lg:w-[420px] lg:bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="grid size-7 place-items-center rounded-lg bg-accent/15 ring-1 ring-accent/40">
          <Sparkles className="size-3.5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Claude</div>
          <div className="truncate text-[11px] text-faint">
            {item ? `Working on: ${item.title}` : pageName(pathname)} · {voiceCount} voice sample
            {voiceCount === 1 ? "" : "s"}
          </div>
        </div>
        <button
          onClick={clearChat}
          title="New chat"
          className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          onClick={() => setOpen(false)}
          title="Close (⌘J)"
          className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </header>

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {chat.length === 0 && (
          <div className="fade-up space-y-3 pt-6 text-center">
            <p className="text-sm text-muted">
              I know your voice samples, your story bank and the card you have open.
            </p>
            <p className="text-xs text-faint">Ask anything, or start with one of these:</p>
            <div className="space-y-2 pt-2 text-left">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent/15 px-3.5 py-2 text-sm text-ink ring-1 ring-accent/20">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="group space-y-2">
              <div className="space-y-2 text-sm leading-relaxed text-ink/90">
                {m.content ? (
                  <Markdown text={m.content} />
                ) : (
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                  </span>
                )}
              </div>
              {m.content && !(busy && m.id === chat[chat.length - 1]?.id) && (
                <div className="flex flex-wrap gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                  <MsgAction onClick={() => copy(m.id, m.content)}>
                    {copied === m.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                    Copy
                  </MsgAction>
                  {item && openItemId && (
                    <>
                      <MsgAction onClick={() => updateItem(openItemId, { script: m.content })}>
                        <FileText className="size-3" /> Use as script
                      </MsgAction>
                      <MsgAction
                        onClick={() =>
                          updateItem(openItemId, {
                            hooks: [...item.hooks, ...extractLines(m.content)].slice(0, 30),
                          })
                        }
                      >
                        <ListPlus className="size-3" /> Add as hooks
                      </MsgAction>
                      <MsgAction onClick={() => updateItem(openItemId, { caption: m.content })}>
                        Use as caption
                      </MsgAction>
                    </>
                  )}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <div className="border-t border-line p-3">
        {!busy && chat.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {quick.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="shrink-0 rounded-full border border-line-strong px-2.5 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-ink"
              >
                {q.length > 46 ? `${q.slice(0, 44)}…` : q}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-line-strong bg-surface-2 focus-within:border-accent/50">
          <textarea
            value={input + (speech.interim ? ` ${speech.interim}` : "")}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={3}
            placeholder={speech.listening ? "Listening… talk it out" : "Ask Claude, or hit the mic and just talk"}
            className="w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            {speech.supported ? (
              <button
                onClick={speech.listening ? speech.stop : speech.start}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs",
                  speech.listening ? "bg-bad/15 text-bad" : "text-faint hover:text-ink",
                )}
              >
                {speech.listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                {speech.listening ? "Stop" : "Talk"}
              </button>
            ) : (
              <span />
            )}
            {busy ? (
              <button
                onClick={() => abort.current?.abort()}
                className="grid size-7 place-items-center rounded-lg bg-surface-3 text-ink"
                title="Stop"
              >
                <Square className="size-3" />
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink disabled:opacity-30"
                title="Send"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function MsgAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[11px] text-muted hover:border-accent/40 hover:text-ink"
    >
      {children}
    </button>
  );
}
