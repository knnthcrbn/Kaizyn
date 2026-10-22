"use client";

import { useState } from "react";
import { CornerDownLeft, Mic, MicOff } from "lucide-react";
import { useHub } from "@/lib/store";
import { FORMATS, PILLARS, PILLAR_STYLE } from "@/lib/meta";
import type { Format, Pillar } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { Button, cx, Segmented, selectCls } from "./ui";

/** Type or say an idea and it lands in the Idea column. */
export function QuickCapture({ autoFocus, onSaved }: { autoFocus?: boolean; onSaved?: (id: string) => void }) {
  const addItem = useHub((s) => s.addItem);
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState<Pillar>("business");
  const [format, setFormat] = useState<Format>("short");
  const [saved, setSaved] = useState(false);
  const speech = useSpeech((said) => setTitle((t) => (t ? `${t} ${said}` : said)));

  const save = () => {
    const t = title.trim();
    if (!t) return;
    speech.stop();
    const id = addItem({
      title: t,
      pillar,
      format,
      scriptMode: format === "broll" ? "broll-overlay" : format === "long" ? "youtube-long" : "talking-short",
    });
    setTitle("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved?.(id);
  };

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface-2 pl-3 pr-1.5 transition-colors focus-within:border-white/25">
        <input
          autoFocus={autoFocus}
          value={title + (speech.interim ? ` ${speech.interim}` : "")}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={speech.listening ? "Listening…" : "What's the idea?"}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ghost focus:outline-none"
        />
        {speech.supported && (
          <button
            onClick={speech.listening ? speech.stop : speech.start}
            title={speech.listening ? "Stop" : "Say it"}
            className={cx(
              "grid size-7 place-items-center rounded-md transition-colors",
              speech.listening ? "bg-critical/15 text-critical-text" : "text-faint hover:bg-surface-3 hover:text-ink",
            )}
          >
            {speech.listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          </button>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Segmented
          value={pillar}
          onChange={setPillar}
          options={PILLARS.map((p) => ({
            value: p.id,
            label: (
              <>
                <span className={cx("size-2 rounded-[3px]", PILLAR_STYLE[p.id].dot)} />
                {p.label}
              </>
            ),
          }))}
        />
        <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={selectCls} aria-label="Format">
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {saved && <span className="text-xs text-good-text">Saved to Ideas</span>}
          <Button variant="primary" onClick={save} disabled={!title.trim()}>
            Save idea <CornerDownLeft className="size-3 opacity-60" />
          </Button>
        </div>
      </div>
    </div>
  );
}
