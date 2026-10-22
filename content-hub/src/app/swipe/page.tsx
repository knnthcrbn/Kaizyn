"use client";

import { useState } from "react";
import { ExternalLink, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, Empty, PageHeader, inputCls } from "@/components/ui";
import { useHub } from "@/lib/store";

export default function SwipePage() {
  const swipe = useHub((s) => s.swipe);
  const addSwipe = useHub((s) => s.addSwipe);
  const deleteSwipe = useHub((s) => s.deleteSwipe);
  const askClaude = useHub((s) => s.askClaude);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const breakdown = (u: string, n: string) =>
    askClaude(
      `Break down why this video works so I can use the pattern: ${u}\nWhat I noticed / what it says: ${n || "(nothing yet)"}\nYou can't watch the video, so work from my notes. Cover the hook, structure, pacing, payoff and on-screen text, then give me 3 ways to use the same pattern for my own content. If my notes are too thin, ask me 2 or 3 questions about it first.`,
    );

  return (
    <div>
      <PageHeader
        title="Swipe file"
        description="Save reels and videos that stopped your scroll. Write what grabbed you (or paste the caption/transcript) and Claude breaks down the pattern so you can use it."
      />

      <Card className="mb-6">
        <form
          className="grid gap-3 p-4 md:grid-cols-[1fr_1.4fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim()) return;
            addSwipe(url.trim(), note.trim());
            setUrl("");
            setNote("");
          }}
        >
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link to the reel / video" className={inputCls} />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What grabbed you? The hook, the overlay, the edit…"
            className={inputCls}
          />
          <Button type="submit" variant="primary" disabled={!url.trim()}>
            <Plus className="size-3.5" /> Save
          </Button>
        </form>
      </Card>

      {swipe.length === 0 ? (
        <Empty>
          <p className="text-[13px] text-muted">Nothing saved yet.</p>
          <p className="mt-1">Next time a video makes you stop scrolling, drop the link here.</p>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {swipe.map((s) => (
            <div key={s.id} className="group flex flex-col rounded-xl border border-line bg-surface p-4">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
              </a>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">{s.note || <span className="text-faint">No notes</span>}</p>
              <div className="mt-3 flex items-center justify-between">
                <Button size="sm" variant="ai" onClick={() => breakdown(s.url, s.note)}>
                  <Sparkles className="size-3" /> Break it down
                </Button>
                <button onClick={() => deleteSwipe(s.id)} className="rounded-md p-1 text-ghost opacity-0 hover:text-critical-text group-hover:opacity-100">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
