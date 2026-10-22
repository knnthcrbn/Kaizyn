"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, Sparkles } from "lucide-react";
import { useHub, useHydrated } from "@/lib/store";
import { Sidebar, Logo } from "./Sidebar";
import { ClaudePanel } from "./ClaudePanel";
import { CommandPalette } from "./CommandPalette";
import { ItemDrawer } from "../ItemDrawer";

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const claudeOpen = useHub((s) => s.claudeOpen);
  const setClaudeOpen = useHub((s) => s.setClaudeOpen);
  const setPaletteOpen = useHub((s) => s.setPaletteOpen);
  const openItem = useHub((s) => s.openItem);

  // Close any open card when changing screens.
  useEffect(() => {
    openItem(null);
  }, [pathname, openItem]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useHub.getState().paletteOpen);
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setClaudeOpen(!useHub.getState().claudeOpen);
      }
      if (e.key === "Escape" && !useHub.getState().paletteOpen) openItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setClaudeOpen, setPaletteOpen, openItem]);

  if (!ready) {
    return (
      <div className="grid h-dvh place-items-center">
        <div className="size-2.5 animate-pulse rounded-full bg-accent shadow-[0_0_16px_4px_rgb(178_177_255/0.6)]" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface/60 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <aside className="slide-in-right absolute inset-y-0 left-0 w-64 border-r border-line bg-surface">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-2.5 lg:hidden">
          <button onClick={() => setNavOpen(true)} className="rounded-md p-1.5 text-muted hover:text-ink">
            <Menu className="size-5" />
          </button>
          <Logo />
          <div className="flex-1" />
          <button
            onClick={() => setClaudeOpen(!claudeOpen)}
            className="rounded-lg bg-accent/10 p-2 text-accent ring-1 ring-accent/30"
          >
            <Sparkles className="size-4" />
          </button>
        </header>
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
        <ItemDrawer />
      </div>

      <ClaudePanel />
      <CommandPalette />
    </div>
  );
}
