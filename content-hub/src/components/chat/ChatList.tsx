"use client";

import { useMemo, useState } from "react";
import { Search, SquarePen, Trash2 } from "lucide-react";
import { deleteChat, newChat, selectChat, useChats } from "@/lib/chats";
import type { Chat } from "@/lib/types";
import { cx } from "../ui";

function groupOf(t: number) {
  const day = 86_400_000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - day) return "Yesterday";
  if (t >= startOfToday - 7 * day) return "Previous 7 days";
  if (t >= startOfToday - 30 * day) return "Previous 30 days";
  return "Older";
}

/** Saved conversations, newest first, with search. */
export function ChatList({ onPick }: { onPick?: () => void }) {
  const chats = useChats((s) => s.chats);
  const activeId = useChats((s) => s.activeId);
  const streaming = useChats((s) => s.streaming);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const shown = chats.filter(
      (c) =>
        c.messages.length > 0 &&
        (!query ||
          c.title.toLowerCase().includes(query) ||
          c.messages.some((m) => m.content.toLowerCase().includes(query))),
    );
    const out: { label: string; chats: Chat[] }[] = [];
    for (const c of shown) {
      const label = groupOf(c.updatedAt);
      const g = out.find((x) => x.label === label);
      if (g) g.chats.push(c);
      else out.push({ label, chats: [c] });
    }
    return out;
  }, [chats, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 p-3">
        <button
          onClick={() => {
            newChat();
            onPick?.();
          }}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 text-[13px] font-medium text-ink hover:bg-surface-3"
        >
          <SquarePen className="size-4" /> New chat
        </button>
        <label className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-white/25">
          <Search className="size-3.5 shrink-0 text-ghost" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ghost focus:outline-none sm:text-[13px]"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-ghost">{q ? "No chats match." : "Your chats will show up here."}</p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-2 pb-1 text-[11px] font-medium text-ghost">{g.label}</div>
            <ul className="space-y-px">
              {g.chats.map((c) => (
                <li key={c.id} className="group relative">
                  <button
                    onClick={() => {
                      selectChat(c.id);
                      setConfirm(null);
                      onPick?.();
                    }}
                    className={cx(
                      "flex h-8 w-full items-center gap-2 rounded-md pl-2 pr-8 text-left text-[13px] transition-colors",
                      c.id === activeId ? "bg-surface-3 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {streaming[c.id] && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-brand" />}
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm === c.id) {
                        deleteChat(c.id);
                        setConfirm(null);
                      } else setConfirm(c.id);
                    }}
                    onBlur={() => setConfirm(null)}
                    title={confirm === c.id ? "Click again to delete" : "Delete chat"}
                    className={cx(
                      "absolute right-1 top-1 grid h-6 place-items-center rounded px-1.5 text-[11px] transition-opacity",
                      confirm === c.id
                        ? "bg-critical/15 text-critical-text opacity-100"
                        : "text-ghost opacity-0 hover:text-critical-text group-hover:opacity-100 max-md:opacity-60",
                    )}
                  >
                    {confirm === c.id ? "Delete?" : <Trash2 className="size-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
