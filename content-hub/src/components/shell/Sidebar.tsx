"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Search, Sparkles } from "lucide-react";
import { NAV } from "@/lib/nav";
import { streakFrom, useHub } from "@/lib/store";
import { cx, Kbd } from "../ui";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-7 place-items-center rounded-lg bg-accent/15 ring-1 ring-accent/40">
        <div className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgb(178_177_255/0.7)]" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">Content Hub</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-faint">systems &gt; goals</div>
      </div>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activityDays = useHub((s) => s.activityDays);
  const setPaletteOpen = useHub((s) => s.setPaletteOpen);
  const setClaudeOpen = useHub((s) => s.setClaudeOpen);
  const streak = streakFrom(activityDays);

  return (
    <nav className="flex h-full flex-col gap-4 px-3 py-4">
      <div className="px-2">
        <Logo />
      </div>

      <button
        onClick={() => setPaletteOpen(true)}
        className="mx-1 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-faint hover:text-muted"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search or jump…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {NAV.map((g, gi) => (
          <div key={gi}>
            {g.group && (
              <div className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-faint">
                {g.group}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cx(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-accent/10 text-ink"
                          : "text-muted hover:bg-surface-3 hover:text-ink",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 -left-3 w-0.5 rounded-full bg-accent shadow-[0_0_10px_rgb(178_177_255)]" />
                      )}
                      <Icon className={cx("size-4", active ? "text-accent" : "text-faint group-hover:text-muted")} />
                      <span className="flex-1">{item.label}</span>
                      {item.soon && (
                        <span className="rounded-full border border-line px-1.5 text-[9px] uppercase tracking-wider text-faint">
                          {item.soon}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <Flame className={cx("size-4", streak ? "text-lifestyle" : "text-faint")} />
          <div className="flex-1 text-xs">
            <div className="font-medium text-ink">
              {streak} day{streak === 1 ? "" : "s"}
            </div>
            <div className="text-faint">creating streak</div>
          </div>
        </div>
        <button
          onClick={() => setClaudeOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl bg-accent/10 px-3 py-2.5 text-sm text-accent ring-1 ring-accent/30 hover:bg-accent/15"
        >
          <Sparkles className="size-4" />
          <span className="flex-1 text-left">Ask Claude</span>
          <Kbd>⌘J</Kbd>
        </button>
      </div>
    </nav>
  );
}
