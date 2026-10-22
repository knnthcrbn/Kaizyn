"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lightbulb, Search, Sparkles } from "lucide-react";
import { ALL_NAV } from "@/lib/nav";
import { useHub } from "@/lib/store";
import { stageLabel } from "@/lib/meta";
import { cx, Kbd } from "../ui";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

export function CommandPalette() {
  const open = useHub((s) => s.paletteOpen);
  const setOpen = useHub((s) => s.setPaletteOpen);
  const items = useHub((s) => s.items);
  const openItem = useHub((s) => s.openItem);
  const addItem = useHub((s) => s.addItem);
  const askClaude = useHub((s) => s.askClaude);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const close = () => {
    setOpen(false);
    setQ("");
    setSel(0);
  };

  const cmds = useMemo<Cmd[]>(() => {
    const query = q.trim().toLowerCase();
    const base: Cmd[] = [];
    if (query) {
      base.push({
        id: "new",
        label: `New idea: “${q.trim()}”`,
        icon: Lightbulb,
        run: () => openItem(addItem({ title: q.trim(), pillar: "business" })),
      });
      base.push({
        id: "ask",
        label: `Ask Claude: “${q.trim()}”`,
        icon: Sparkles,
        run: () => askClaude(q.trim()),
      });
    }
    const nav: Cmd[] = ALL_NAV.map((n) => ({
      id: n.href,
      label: `Go to ${n.label}`,
      hint: n.soon,
      icon: n.icon,
      run: () => router.push(n.href),
    }));
    const cards: Cmd[] = items.map((i) => ({
      id: i.id,
      label: i.title,
      hint: stageLabel(i.stage),
      icon: FileText,
      run: () => openItem(i.id),
    }));
    const all = [...nav, ...cards];
    const filtered = query ? all.filter((c) => c.label.toLowerCase().includes(query)) : nav;
    // Real matches first; "new idea" and "ask Claude" are the fallbacks.
    return [...filtered.slice(0, 10), ...base];
  }, [q, items, router, openItem, addItem, askClaude]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh] backdrop-blur-[2px]" onClick={close}>
      <div
        className="fade-in w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(cmds.length - 1, s + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === "Enter" && cmds[sel]) {
                cmds[sel].run();
                close();
              }
            }}
            placeholder="Jump to a screen, find a card, capture an idea, ask Claude…"
            className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-ghost focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {cmds.map((c, i) => {
            const Icon = c.icon;
            return (
              <li key={c.id}>
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={() => {
                    c.run();
                    close();
                  }}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px]",
                    i === sel ? "bg-surface-3 text-ink" : "text-muted",
                  )}
                >
                  <Icon className={cx("size-4", i === sel ? "text-ink" : "text-faint")} />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-[11px] text-faint">{c.hint}</span>}
                </button>
              </li>
            );
          })}
          {!cmds.length && <li className="px-3 py-6 text-center text-sm text-faint">Nothing found.</li>}
        </ul>
      </div>
    </div>
  );
}
