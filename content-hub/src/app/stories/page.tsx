"use client";

import { useState } from "react";
import { Clapperboard, MessageCircleQuestion, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, PageHeader, inputCls } from "@/components/ui";
import { useHub } from "@/lib/store";
import type { Story } from "@/lib/types";

export default function StoriesPage() {
  const stories = useHub((s) => s.stories);
  const items = useHub((s) => s.items);
  const addStory = useHub((s) => s.addStory);
  const [editing, setEditing] = useState<string | null>(null);
  const current = stories.find((s) => s.id === editing);

  return (
    <div>
      <PageHeader
        title="Story bank"
        description="Your life is the content. Bank every story once, tag the lessons, and one story can power dozens of videos."
        actions={
          <Button variant="primary" onClick={() => setEditing(addStory())}>
            <Plus className="size-3.5" /> New story
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stories.map((s) => {
          const told = !!s.whatHappened.trim();
          const used = items.filter((i) => i.storyIds.includes(s.id)).length;
          return (
            <button
              key={s.id}
              onClick={() => setEditing(s.id)}
              className="group flex flex-col rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <div className="mb-3 flex items-center justify-between">
                <Badge tone={told ? "good" : "warning"}>{told ? "Captured" : "Not told yet"}</Badge>
                <span className="text-[11px] text-faint">
                  {used} video{used === 1 ? "" : "s"}
                </span>
              </div>
              <div className="text-[13px] font-medium text-ink">{s.title}</div>
              <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-faint">
                {s.lesson || s.whatHappened || s.questions[0] || "Add what happened and the lesson."}
              </p>
              {s.themes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.themes.map((t) => (
                    <span key={t} className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-faint">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {current && <StoryEditor story={current} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StoryEditor({ story, onClose }: { story: Story; onClose: () => void }) {
  const update = useHub((s) => s.updateStory);
  const del = useHub((s) => s.deleteStory);
  const askClaude = useHub((s) => s.askClaude);
  const addItem = useHub((s) => s.addItem);
  const openItem = useHub((s) => s.openItem);
  const [themes, setThemes] = useState(story.themes.join(", "));
  const set = (patch: Partial<Story>) => update(story.id, patch);

  const interview = () => {
    onClose();
    askClaude(
      `Interview me about my story "${story.title}" so we can bank it properly. Ask one question at a time and wait for my answer.${
        story.questions.length ? ` Start from these: ${story.questions.join(" / ")}` : ""
      } When we're done, write up "What happened" and "The lesson" in my words so I can paste them into the story bank.`,
    );
  };

  const toVideo = () => {
    const business = story.themes.some((t) => /business|leadership|team|ads|sales|marketing/i.test(t));
    const id = addItem({
      title: story.title,
      pillar: business ? "business" : "personal",
      format: "short",
      scriptMode: "story",
      storyIds: [story.id],
      notes: story.lesson ? `Lesson: ${story.lesson}` : "",
    });
    onClose();
    openItem(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/60"
      >
        <header className="flex items-center gap-2 border-b border-line px-5 py-3">
          <input
            value={story.title}
            onChange={(e) => set({ title: e.target.value })}
            className="flex-1 bg-transparent text-base font-semibold focus:outline-none"
          />
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm("Delete this story?")) {
                del(story.id);
                onClose();
              }
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink">
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          {story.questions.length > 0 && (
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="mb-1.5 text-xs font-medium text-ink">Questions to get it out of your head</div>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted">
                {story.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">What happened</span>
            <textarea
              value={story.whatHappened}
              onChange={(e) => set({ whatHappened: e.target.value })}
              rows={7}
              placeholder="Tell it like you'd tell a friend. Messy is fine."
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">The lesson (in your words)</span>
            <textarea
              value={story.lesson}
              onChange={(e) => set({ lesson: e.target.value })}
              rows={3}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Themes (comma separated)</span>
            <input
              value={themes}
              onChange={(e) => setThemes(e.target.value)}
              onBlur={() =>
                set({
                  themes: themes
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              className={inputCls}
            />
          </label>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ai" onClick={interview}>
            <MessageCircleQuestion className="size-3.5" /> Have Claude interview me
          </Button>
          <Button variant="primary" onClick={toVideo}>
            <Clapperboard className="size-3.5" /> Turn into a video
          </Button>
        </footer>
      </div>
    </div>
  );
}
