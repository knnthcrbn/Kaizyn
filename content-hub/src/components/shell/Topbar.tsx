"use client";

import { usePathname } from "next/navigation";
import { Menu, Plus, Search, Sparkles } from "lucide-react";
import { ALL_NAV } from "@/lib/nav";
import { useHub } from "@/lib/store";
import { Button, Kbd } from "../ui";
import { Logo } from "./Sidebar";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const setPaletteOpen = useHub((s) => s.setPaletteOpen);
  const setCaptureOpen = useHub((s) => s.setCaptureOpen);
  const claudeOpen = useHub((s) => s.claudeOpen);
  const setClaudeOpen = useHub((s) => s.setClaudeOpen);
  const page = ALL_NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
      <button onClick={onMenu} className="-ml-1 rounded-md p-1.5 text-muted hover:text-ink lg:hidden" aria-label="Menu">
        <Menu className="size-4" />
      </button>
      <div className="lg:hidden">
        <Logo />
      </div>
      <div className="hidden items-center gap-2 text-[13px] lg:flex">
        <span className="text-faint">Content Hub</span>
        <span className="text-ghost">/</span>
        <span className="font-medium text-ink">{page?.label ?? "Home"}</span>
      </div>

      <button
        onClick={() => setPaletteOpen(true)}
        className="ml-auto hidden h-8 w-64 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ghost transition-colors hover:border-line-strong hover:text-faint md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <button
        onClick={() => setPaletteOpen(true)}
        className="ml-auto rounded-md p-1.5 text-muted hover:text-ink md:hidden"
        aria-label="Search"
      >
        <Search className="size-4" />
      </button>

      <Button onClick={() => setCaptureOpen(true)} title="Capture an idea (C)">
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">Capture</span>
      </Button>
      <Button variant="ai" onClick={() => setClaudeOpen(!claudeOpen)} title="Ask Claude (⌘J)">
        <Sparkles className="size-3.5" />
        <span className="hidden sm:inline">Ask Claude</span>
      </Button>
    </header>
  );
}
