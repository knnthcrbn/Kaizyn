"use client";

import { useState } from "react";
import {
  AlignLeft,
  Brain,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Globe,
  ListPlus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { retryLast, useChats, useLive } from "@/lib/chats";
import { effortLabel, formatCost, modelInfo } from "@/lib/models";
import { useHub } from "@/lib/store";
import type { ChatMessage, ChatSource } from "@/lib/types";
import { extractLines, Markdown } from "../Markdown";
import { cx } from "../ui";

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function Thread({ chatId, page }: { chatId: string; page: string }) {
  const messages = useChats((s) => s.chats.find((c) => c.id === chatId)?.messages);
  if (!messages) return null;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  return (
    <div className="space-y-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserMessage key={m.id} m={m} />
        ) : (
          <AssistantMessage key={m.id} m={m} chatId={chatId} page={page} last={m.id === lastAssistant} />
        ),
      )}
    </div>
  );
}

function UserMessage({ m }: { m: ChatMessage }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {m.attachments?.length ? (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {m.attachments.map((a) =>
            a.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={a.thumb} alt={a.name} title={a.name} className="size-16 rounded-lg border border-line object-cover" />
            ) : (
              <span
                key={a.id}
                className="flex h-9 max-w-[220px] items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-xs text-muted"
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{a.name}</span>
              </span>
            ),
          )}
        </div>
      ) : null}
      {m.content && (
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-surface-3 px-3.5 py-2 text-[14px] leading-relaxed text-ink">
          {m.content}
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ m, chatId, page, last }: { m: ChatMessage; chatId: string; page: string; last: boolean }) {
  const live = useLive((s) => s[m.id]);
  const streaming = m.status === "streaming";
  const text = streaming ? (live?.text ?? "") : m.content;
  const thinking = streaming ? (live?.thinking ?? "") : (m.thinking ?? "");
  const searches = streaming ? (live?.searches ?? []) : (m.searches ?? []);
  const sources = streaming ? (live?.sources ?? []) : (m.sources ?? []);
  const thinkingMs = streaming ? live?.thinkingMs : m.thinkingMs;

  const item = useHub((s) => s.items.find((i) => i.id === s.openItemId));
  const updateItem = useHub((s) => s.updateItem);
  const [copied, setCopied] = useState(false);

  const status = !streaming
    ? null
    : !text && searches.length && !thinking
      ? "Searching the web…"
      : !text
        ? "Thinking…"
        : null;

  return (
    <div className="group">
      {(thinking || (streaming && !text)) && (
        <Thinking text={thinking} ms={thinkingMs} active={streaming && !text} label={status} />
      )}
      {searches.length > 0 && <Searches items={searches} />}

      {text && (
        <div className="space-y-2.5 text-[14px] leading-relaxed text-ink/90">
          <Markdown text={text} />
        </div>
      )}
      {!streaming && !text && m.status === "stopped" && <p className="text-xs text-ghost">Stopped.</p>}

      {m.status === "error" && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-[13px] text-critical-text">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{m.error}</span>
        </div>
      )}

      {sources.length > 0 && <Sources items={sources} />}

      {!streaming && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {text && (
            <Action
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </Action>
          )}
          {last && (
            <Action onClick={() => void retryLast(chatId, page)}>
              <RefreshCw className="size-3" /> Retry
            </Action>
          )}
          {item && text && (
            <>
              <Action onClick={() => updateItem(item.id, { script: text })}>
                <FileText className="size-3" /> Use as script
              </Action>
              <Action onClick={() => updateItem(item.id, { hooks: [...item.hooks, ...extractLines(text)].slice(0, 30) })}>
                <ListPlus className="size-3" /> Add as hooks
              </Action>
              <Action onClick={() => updateItem(item.id, { caption: text })}>
                <AlignLeft className="size-3" /> Use as caption
              </Action>
            </>
          )}
          {m.model && (
            <span className="ml-auto pl-2 text-[11px] text-ghost opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
              {modelInfo(m.model).label} · {effortLabel(m.effort)}
              {m.cost != null && ` · ≈${formatCost(m.cost)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Thinking({ text, ms, active, label }: { text: string; ms?: number; active: boolean; label: string | null }) {
  const [open, setOpen] = useState(false);
  const secs = ms ? Math.max(1, Math.round(ms / 1000)) : null;
  return (
    <div className="mb-2.5">
      <button
        onClick={() => text && setOpen((v) => !v)}
        className={cx("inline-flex items-center gap-1.5 text-xs", text ? "text-faint hover:text-ink" : "cursor-default text-faint")}
      >
        <Brain className={cx("size-3.5", active && "animate-pulse text-brand")} />
        {active ? (label ?? "Thinking…") : secs ? `Thought for ${secs}s` : "Thought it through"}
        {text && <ChevronRight className={cx("size-3 transition-transform", open && "rotate-90")} />}
      </button>
      {open && text && (
        <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-faint">
          {text}
        </div>
      )}
    </div>
  );
}

function Searches({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  const reads = items.filter((x) => /^https?:\/\//.test(x));
  const queries = items.filter((x) => !/^https?:\/\//.test(x));
  const summary = [
    queries.length ? `Searched the web${queries.length > 1 ? ` ${queries.length}×` : ""}` : "",
    reads.length ? `read ${reads.length} page${reads.length > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="mb-2.5">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-ink">
        <Globe className="size-3.5" />
        {summary.charAt(0).toUpperCase() + summary.slice(1)}
        <ChevronRight className={cx("size-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5 border-l-2 border-line pl-3 text-[12px] text-faint">
          {queries.map((q, i) => (
            <li key={`q${i}`}>“{q}”</li>
          ))}
          {reads.map((u, i) => (
            <li key={`r${i}`}>
              Read{" "}
              <a href={u} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 hover:text-ink">
                {host(u)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sources({ items }: { items: ChatSource[] }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] font-medium text-ghost">Sources</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.title}
            className="inline-flex h-6 max-w-[220px] items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 text-[11px] text-muted hover:border-line-strong hover:text-ink"
          >
            <span className="text-ghost">{i + 1}</span>
            <span className="truncate">{host(s.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Action({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-faint transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {children}
    </button>
  );
}
