"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Maximize2, Sparkles, SquarePen, X } from "lucide-react";
import { useHub } from "@/lib/store";
import { newChat, useChats } from "@/lib/chats";
import { pageName } from "@/lib/nav";
import { ChatList } from "../chat/ChatList";
import { ChatView } from "../chat/ChatView";
import { cx } from "../ui";

/** Claude beside whatever screen is open. The same chats as /chat. */
export function ClaudePanel() {
  const pathname = usePathname();
  const open = useHub((s) => s.claudeOpen);
  const setOpen = useHub((s) => s.setClaudeOpen);
  const item = useHub((s) => s.items.find((i) => i.id === s.openItemId));
  const chat = useChats((s) => s.chats.find((c) => c.id === s.activeId) ?? null);
  const [history, setHistory] = useState(false);

  if (!open) return null;
  const page = pageName(pathname);

  return (
    <aside className="slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-2xl shadow-black/50 lg:static lg:z-auto lg:w-[420px] lg:shadow-none">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line pl-4 pr-2">
        <Sparkles className="mr-1.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight">
            {history ? "Chats" : chat && chat.messages.length ? chat.title : "Claude"}
          </div>
          <div className="truncate text-[11px] leading-tight text-faint">{item ? item.title : page}</div>
        </div>
        <HeaderButton title="Chats" on={history} onClick={() => setHistory((v) => !v)}>
          <History className="size-3.5" />
        </HeaderButton>
        <HeaderButton
          title="New chat"
          onClick={() => {
            newChat();
            setHistory(false);
          }}
        >
          <SquarePen className="size-3.5" />
        </HeaderButton>
        <Link
          href="/chat"
          onClick={() => setOpen(false)}
          title="Full screen"
          className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
        >
          <Maximize2 className="size-3.5" />
        </Link>
        <HeaderButton title="Close (⌘J)" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </HeaderButton>
      </header>

      {history ? <ChatList onPick={() => setHistory(false)} /> : <ChatView page={page} compact />}
    </aside>
  );
}

function HeaderButton({
  children,
  title,
  on,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cx("rounded-md p-1.5 hover:bg-surface-3 hover:text-ink", on ? "bg-surface-3 text-ink" : "text-faint")}
    >
      {children}
    </button>
  );
}
