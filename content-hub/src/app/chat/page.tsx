"use client";

import { useState } from "react";
import { PanelLeft, SquarePen, X } from "lucide-react";
import { ChatList } from "@/components/chat/ChatList";
import { ChatView } from "@/components/chat/ChatView";
import { newChat, renameChat, useChats } from "@/lib/chats";

// Claude, full screen: the hub's answer to opening the Claude app.
export default function ChatPage() {
  const chat = useChats((s) => s.chats.find((c) => c.id === s.activeId) ?? null);
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line md:flex">
        <ChatList />
      </aside>

      {listOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setListOpen(false)} />
          <aside className="slide-in absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-bg">
            <div className="flex h-12 items-center justify-between border-b border-line px-3">
              <span className="text-[13px] font-medium text-ink">Chats</span>
              <button onClick={() => setListOpen(false)} className="rounded-md p-1.5 text-faint hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <ChatList onPick={() => setListOpen(false)} />
          </aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2 sm:px-3">
          <button
            onClick={() => setListOpen(true)}
            className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink md:hidden"
            aria-label="Chats"
          >
            <PanelLeft className="size-4" />
          </button>
          {chat && chat.messages.length > 0 ? (
            editing ? (
              <input
                autoFocus
                defaultValue={chat.title}
                onBlur={(e) => {
                  renameChat(chat.id, e.target.value);
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface-2 px-2 text-base text-ink focus:outline-none sm:text-[13px]"
              />
            ) : (
              <button
                onClick={() => setEditing(true)}
                title="Rename"
                className="min-w-0 truncate rounded-md px-2 py-1 text-left text-[13px] font-medium text-ink hover:bg-surface-2"
              >
                {chat.title}
              </button>
            )
          ) : (
            <span className="px-2 text-[13px] font-medium text-ink">New chat</span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => newChat()}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
            title="New chat"
          >
            <SquarePen className="size-4" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </header>
        <ChatView page="Claude screen" />
      </section>
    </div>
  );
}
