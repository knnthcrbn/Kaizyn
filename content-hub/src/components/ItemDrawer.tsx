"use client";

import { useState } from "react";
import { MonitorPlay, Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import { useHub } from "@/lib/store";
import { FORMATS, PILLARS, SCRIPT_MODES, STAGES, scriptModeLabel } from "@/lib/meta";
import type { ContentItem, Format, Pillar, ScriptMode, StageId } from "@/lib/types";
import { Button, cx, inputCls, PillarBadge } from "./ui";
import { LintPanel } from "./LintPanel";
import { Teleprompter } from "./Teleprompter";

type Tab = "hooks" | "script" | "caption" | "notes";

const selectCls =
  "rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-ink focus:border-accent/60 focus:outline-none";

export function ItemDrawer() {
  const item = useHub((s) => s.items.find((i) => i.id === s.openItemId));
  const openItem = useHub((s) => s.openItem);
  if (!item) return null;
  // Keyed so local tab state resets when a different card opens.
  return <DrawerBody key={item.id} item={item} onClose={() => openItem(null)} />;
}

function DrawerBody({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const update = useHub((s) => s.updateItem);
  const del = useHub((s) => s.deleteItem);
  const askClaude = useHub((s) => s.askClaude);
  const stories = useHub((s) => s.stories);
  const [tab, setTab] = useState<Tab>(item.script ? "script" : "hooks");
  const [newHook, setNewHook] = useState("");
  const [prompter, setPrompter] = useState(false);
  const set = (patch: Partial<ContentItem>) => update(item.id, patch);

  const words = item.script.trim() ? item.script.trim().split(/\s+/).length : 0;
  const seconds = Math.round((words / 150) * 60);

  return (
    <>
      <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="slide-in-right absolute inset-y-0 right-0 z-30 flex w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl">
        <header className="flex items-center gap-2 border-b border-line px-5 py-3">
          <PillarBadge pillar={item.pillar} />
          <span className="text-xs text-faint">·</span>
          <select
            value={item.stage}
            onChange={(e) => set({ stage: e.target.value as StageId })}
            className={selectCls}
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setPrompter(true)} title="Teleprompter">
            <MonitorPlay className="size-3.5" /> Teleprompter
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm("Delete this card?")) del(item.id);
            }}
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <input
            value={item.title}
            onChange={(e) => set({ title: e.target.value })}
            className="w-full bg-transparent text-xl font-semibold tracking-tight text-ink focus:outline-none"
            placeholder="Working title"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <select value={item.pillar} onChange={(e) => set({ pillar: e.target.value as Pillar })} className={selectCls}>
              {PILLARS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select value={item.format} onChange={(e) => set({ format: e.target.value as Format })} className={selectCls}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-faint">
              Due
              <input
                type="date"
                value={item.dueDate ?? ""}
                onChange={(e) => set({ dueDate: e.target.value || undefined })}
                className={cx(selectCls, "[color-scheme:dark]")}
              />
            </label>
          </div>

          <div className="mt-6 flex gap-1 border-b border-line">
            {(
              [
                ["hooks", `Hooks (${item.hooks.length})`],
                ["script", "Script"],
                ["caption", "Caption"],
                ["notes", "Notes & stories"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cx(
                  "-mb-px border-b-2 px-3 py-2 text-sm",
                  tab === id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {tab === "hooks" && (
              <>
                <p className="text-xs text-faint">Star the hook you&apos;re going with. Test the rest as trial reels.</p>
                <ul className="space-y-2">
                  {item.hooks.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <button
                        onClick={() => set({ chosenHook: i })}
                        className={cx("mt-2", i === item.chosenHook ? "text-accent" : "text-faint hover:text-muted")}
                        title="Use this hook"
                      >
                        <Star className={cx("size-4", i === item.chosenHook && "fill-accent")} />
                      </button>
                      <textarea
                        value={h}
                        rows={2}
                        onChange={(e) => set({ hooks: item.hooks.map((x, j) => (j === i ? e.target.value : x)) })}
                        className={cx(inputCls, "resize-none")}
                      />
                      <button
                        onClick={() =>
                          set({
                            hooks: item.hooks.filter((_, j) => j !== i),
                            chosenHook: Math.max(0, item.chosenHook - (i <= item.chosenHook ? 1 : 0)),
                          })
                        }
                        className="mt-2 text-faint hover:text-bad"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newHook.trim()) return;
                    set({ hooks: [...item.hooks, newHook.trim()] });
                    setNewHook("");
                  }}
                >
                  <input value={newHook} onChange={(e) => setNewHook(e.target.value)} placeholder="Add a hook…" className={inputCls} />
                  <Button type="submit">
                    <Plus className="size-4" />
                  </Button>
                </form>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">On-screen overlay / banner text</label>
                  <input
                    value={item.overlay}
                    onChange={(e) => set({ overlay: e.target.value })}
                    placeholder="the line that sits on screen in the first 2 seconds"
                    className={inputCls}
                  />
                </div>
                <Button variant="primary" onClick={() => askClaude("Give me 5 more hooks for this card. Different hook types. One per line.")}>
                  <Sparkles className="size-4" /> More hooks with Claude
                </Button>
              </>
            )}

            {tab === "script" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={item.scriptMode}
                    onChange={(e) => set({ scriptMode: e.target.value as ScriptMode })}
                    className={selectCls}
                  >
                    {SCRIPT_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-faint">{SCRIPT_MODES.find((m) => m.id === item.scriptMode)?.shape}</span>
                </div>
                <textarea
                  value={item.script}
                  onChange={(e) => set({ script: e.target.value })}
                  rows={14}
                  placeholder="Write it how you'd say it. Or let Claude draft it from your voice, then fix it."
                  className={cx(inputCls, "font-[450] leading-relaxed")}
                />
                <div className="flex items-center justify-between text-xs text-faint">
                  <span>
                    {words} words · ~{seconds}s spoken
                  </span>
                </div>
                <LintPanel text={item.script} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() =>
                      askClaude(`Write the ${scriptModeLabel(item.scriptMode).toLowerCase()} script for this card in my voice. Open with the starred hook.`)
                    }
                  >
                    <Sparkles className="size-4" /> Draft with Claude
                  </Button>
                  <Button
                    disabled={!item.script.trim()}
                    onClick={() => askClaude("Read my script back and make it sound more like me and less like AI. Return only the new script.")}
                  >
                    Make it sound like me
                  </Button>
                  <Button
                    onClick={() => askClaude("Interview me for this video. Ask one question at a time, then build the script from my answers.")}
                  >
                    Interview me instead
                  </Button>
                  <Button variant="ghost" onClick={() => setPrompter(true)}>
                    <MonitorPlay className="size-4" /> Teleprompter
                  </Button>
                </div>
              </>
            )}

            {tab === "caption" && (
              <>
                <textarea
                  value={item.caption}
                  onChange={(e) => set({ caption: e.target.value })}
                  rows={8}
                  placeholder="Caption and hashtags"
                  className={inputCls}
                />
                <LintPanel text={item.caption} />
                <Button
                  variant="primary"
                  onClick={() =>
                    askClaude("Write the caption for this post. Short, sounds like me, ends with a reason to comment or share. Add 3 to 5 relevant hashtags.")
                  }
                >
                  <Sparkles className="size-4" /> Write caption with Claude
                </Button>
              </>
            )}

            {tab === "notes" && (
              <>
                <textarea
                  value={item.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={6}
                  placeholder="Angle, references, shot ideas, proof to show…"
                  className={inputCls}
                />
                <div>
                  <div className="mb-2 text-xs font-medium text-muted">Linked stories</div>
                  <div className="flex flex-wrap gap-2">
                    {stories.map((st) => {
                      const on = item.storyIds.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          onClick={() =>
                            set({
                              storyIds: on ? item.storyIds.filter((x) => x !== st.id) : [...item.storyIds, st.id],
                            })
                          }
                          className={cx(
                            "rounded-full border px-3 py-1 text-xs",
                            on ? "border-accent/50 bg-accent/15 text-accent" : "border-line-strong text-muted hover:text-ink",
                          )}
                        >
                          {st.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {prompter && (
        <Teleprompter
          text={item.script || item.hooks[item.chosenHook] || ""}
          onClose={() => setPrompter(false)}
        />
      )}
    </>
  );
}
