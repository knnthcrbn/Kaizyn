"use client";

import { useState } from "react";
import { Mic, MicOff, Plus } from "lucide-react";
import { useHub } from "@/lib/store";
import { PILLARS, PILLAR_STYLE } from "@/lib/meta";
import type { Pillar } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { cx } from "./ui";

/** Type or say an idea and it lands in the Idea column. */
export function QuickCapture({ autoFocus }: { autoFocus?: boolean }) {
  const addItem = useHub((s) => s.addItem);
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState<Pillar>("business");
  const [saved, setSaved] = useState(false);
  const speech = useSpeech((said) => setTitle((t) => (t ? `${t} ${said}` : said)));

  const save = () => {
    const t = title.trim();
    if (!t) return;
    addItem({ title: t, pillar, format: pillar === "lifestyle" ? "broll" : "short" });
    setTitle("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2/80 p-2 backdrop-blur focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_rgb(178_177_255/0.08)]">
      <div className="flex items-center gap-2">
        <input
          autoFocus={autoFocus}
          value={title + (speech.interim ? ` ${speech.interim}` : "")}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={speech.listening ? "Listening…" : "Got an idea? Dump it here before it's gone."}
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[15px] text-ink placeholder:text-faint focus:outline-none"
        />
        {speech.supported && (
          <button
            onClick={speech.listening ? speech.stop : speech.start}
            title="Say it"
            className={cx(
              "grid size-9 place-items-center rounded-xl",
              speech.listening ? "bg-bad/15 text-bad" : "text-faint hover:bg-surface-3 hover:text-ink",
            )}
          >
            {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
        )}
        <button
          onClick={save}
          disabled={!title.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-medium text-accent-ink disabled:opacity-30"
        >
          <Plus className="size-4" /> <span className="hidden sm:inline">{saved ? "Saved" : "Capture"}</span>
        </button>
      </div>
      <div className="mt-1.5 flex gap-1.5 px-1">
        {PILLARS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPillar(p.id)}
            className={cx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
              pillar === p.id ? cx(PILLAR_STYLE[p.id].bg, PILLAR_STYLE[p.id].text) : "text-faint hover:text-muted",
            )}
          >
            <span className={cx("size-1.5 rounded-full", PILLAR_STYLE[p.id].dot)} />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
