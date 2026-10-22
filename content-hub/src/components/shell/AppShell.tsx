"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useHub, useHydrated } from "@/lib/store";
import { chatForQuickAsk, loadChats, sendMessage, useChats } from "@/lib/chats";
import { pageName } from "@/lib/nav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ClaudePanel } from "./ClaudePanel";
import { CommandPalette } from "./CommandPalette";
import { CaptureDialog } from "./CaptureDialog";
import { ItemDrawer } from "../ItemDrawer";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const openItem = useHub((s) => s.openItem);
  const onLogin = pathname === "/login";
  const onChat = pathname === "/chat";
  const onLoginRef = useRef(onLogin);
  const onChatRef = useRef(onChat);
  const pageRef = useRef(pageName(pathname));
  useEffect(() => {
    onLoginRef.current = onLogin;
    onChatRef.current = onChat;
    pageRef.current = pageName(pathname);
  });

  // Chats load after the hub store, which hands over the old single chat.
  useEffect(() => {
    if (ready && !onLogin) void loadChats();
  }, [ready, onLogin]);

  // "Ask Claude" buttons anywhere in the hub queue a prompt; send it once chats are loaded.
  useEffect(() => {
    const run = () => {
      if (!useHub.getState().pendingPrompt || !useChats.getState().loaded) return;
      const id = chatForQuickAsk();
      const prompt = useHub.getState().takePendingPrompt();
      if (prompt) void sendMessage(id, prompt, [], pageRef.current);
    };
    const offHub = useHub.subscribe(run);
    const offChats = useChats.subscribe((s, prev) => s.loaded !== prev.loaded && run());
    run();
    return () => {
      offHub();
      offChats();
    };
  }, []);

  // Close any open card when changing screens.
  useEffect(() => {
    openItem(null);
  }, [pathname, openItem]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (onLoginRef.current) return;
      const s = useHub.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setPaletteOpen(!s.paletteOpen);
      } else if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        // Claude already has the whole screen on /chat.
        if (onChatRef.current) document.querySelector<HTMLTextAreaElement>("[data-composer]")?.focus();
        else s.setClaudeOpen(!s.claudeOpen);
      } else if (e.key === "Escape") {
        if (s.captureOpen) s.setCaptureOpen(false);
        else if (!s.paletteOpen) s.openItem(null);
      } else if (!mod && !e.altKey && e.key.toLowerCase() === "c" && !typing(e.target)) {
        e.preventDefault();
        s.setCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The sign-in screen stands alone, outside the app frame.
  if (onLogin) return <div className="h-full overflow-y-auto">{children}</div>;

  if (!ready) {
    return <div className="h-full bg-bg" />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-56 shrink-0 border-r border-line bg-bg lg:block">
        <Sidebar />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <aside className="slide-in absolute inset-y-0 left-0 w-64 border-r border-line bg-bg">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setNavOpen(true)} />
        {onChat ? (
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        ) : (
          <main className="relative flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        )}
        <ItemDrawer />
      </div>

      {!onChat && <ClaudePanel />}
      <CommandPalette />
      <CaptureDialog />
    </div>
  );
}
