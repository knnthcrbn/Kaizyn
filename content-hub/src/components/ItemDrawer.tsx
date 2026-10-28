"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Clapperboard, FlaskConical, MonitorPlay, Plus, Sparkles, Trash2, X } from "lucide-react";
import { editForCard, studioUrl } from "@/lib/studio/actions";
import { IN_CLAUDE } from "@/lib/platform";
import { useHub } from "@/lib/store";
import { FORMATS, PILLARS, PILLAR_STYLE, SCRIPT_MODES, STAGES, scriptModeLabel } from "@/lib/meta";
import type { ContentItem, Format, Pillar, ScriptMode, StageId } from "@/lib/types";
import { Button, ConfirmAction, cx, inputCls, selectCls, StageIcon, Tabs } from "./ui";
import { LintPanel } from "./LintPanel";
import { Teleprompter } from "./Teleprompter";
import { HOOK_TYPES } from "@/lib/hookTypes";
import { compact } from "@/lib/insights";
import { clockLabel, platformLabel } from "@/lib/plan";
import { PlatformDot } from "./plan/bits";
import { PostDialog } from "./plan/PostDialog";
import { ScheduleDialog } from "./plan/ScheduleDialog";
import { TestDialog } from "./analytics/TestDialog";

type Tab = "hooks" | "script" | "caption" | "posts" | "notes";

export function ItemDrawer() {
  const item = useHub((s) => s.items.find((i) => i.id === s.openItemId));
  const openItem = useHub((s) => s.openItem);
  if (!item) return null;
  // Keyed so local tab state resets when a different card opens.
  return <DrawerBody key={item.id} item={item} onClose={() => openItem(null)} />;
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-faint">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function DrawerBody({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const update = useHub((s) => s.updateItem);
  const del = useHub((s) => s.deleteItem);
  const askClaude = useHub((s) => s.askClaude);
  const stories = useHub((s) => s.stories);
  const [tab, setTab] = useState<Tab>(item.script ? "script" : "hooks");
  const [newHook, setNewHook] = useState("");
  const [prompter, setPrompter] = useState(false);
  const router = useRouter();
  const hasEdit = useHub((s) => s.edits.some((e) => e.cardId === item.id));
  const allPosts = useHub((s) => s.posts);
  const accounts = useHub((s) => s.accounts);
  const posts = allPosts.filter((p) => p.cardId === item.id).sort((a, b) => a.at - b.at);
  const [scheduling, setScheduling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const set = (patch: Partial<ContentItem>) => update(item.id, patch);

  const words = item.script.trim() ? item.script.trim().split(/\s+/).length : 0;
  const seconds = Math.round((words / 150) * 60);
  const propSelect = cx(selectCls, "h-7 min-w-0 flex-1 border-transparent bg-transparent px-1.5 hover:bg-surface-2");

  return (
    <>
      <div className="absolute inset-0 z-20 bg-black/50" onClick={onClose} />
      <div className="slide-in absolute inset-y-0 right-0 z-30 flex w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl shadow-black/60">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
          <span className="text-xs text-faint">Pipeline</span>
          <span className="text-xs text-ghost">/</span>
          <span className="truncate text-xs text-muted">{STAGES.find((s) => s.id === item.stage)?.label}</span>
          <div className="flex-1" />
          {!IN_CLAUDE && (
            <Button size="sm" onClick={() => router.push(studioUrl(editForCard(item.id)))} title="Cut this card's video in Studio">
              <Clapperboard className="size-3.5" /> {hasEdit ? "Open edit" : "Edit video"}
            </Button>
          )}
          <Button size="sm" onClick={() => setPrompter(true)}>
            <MonitorPlay className="size-3.5" /> Teleprompter
          </Button>
          <ConfirmAction
            question="Delete this card?"
            onConfirm={() => del(item.id)}
            className="rounded-md p-1.5 text-faint hover:bg-critical/10 hover:text-critical-text"
            title="Delete card"
          >
            <Trash2 className="size-3.5" />
          </ConfirmAction>
          <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink" title="Close (Esc)">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <input
            value={item.title}
            onChange={(e) => set({ title: e.target.value })}
            className="w-full bg-transparent text-lg font-semibold tracking-tight text-ink placeholder:text-ghost focus:outline-none"
            placeholder="Working title"
          />

          <div className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <Prop label="Stage">
              <StageIcon stage={item.stage} />
              <select value={item.stage} onChange={(e) => set({ stage: e.target.value as StageId })} className={propSelect}>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Prop>
            <Prop label="Pillar">
              <span className={cx("size-2 shrink-0 rounded-[3px]", PILLAR_STYLE[item.pillar].dot)} />
              <select value={item.pillar} onChange={(e) => set({ pillar: e.target.value as Pillar })} className={propSelect}>
                {PILLARS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Prop>
            <Prop label="Format">
              <select value={item.format} onChange={(e) => set({ format: e.target.value as Format })} className={propSelect}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Prop>
            <Prop label="Due">
              <input
                type="date"
                value={item.dueDate ?? ""}
                onChange={(e) => set({ dueDate: e.target.value || undefined })}
                className={propSelect}
              />
            </Prop>
          </div>

          <div className="mt-6">
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "hooks", label: `Hooks · ${item.hooks.length}` },
                { value: "script", label: "Script" },
                { value: "caption", label: "Caption" },
                { value: "posts", label: `Posts${posts.length ? ` · ${posts.length}` : ""}` },
                { value: "notes", label: "Notes & stories" },
              ]}
            />
          </div>

          <div className="mt-5 space-y-4">
            {tab === "hooks" && (
              <>
                <ul className="space-y-2">
                  {item.hooks.map((h, i) => {
                    const chosen = i === item.chosenHook;
                    return (
                      <li key={i} className={cx("group rounded-lg border p-2 transition-colors", chosen ? "border-line-strong bg-surface-2" : "border-line")}>
                        <textarea
                          value={h}
                          rows={2}
                          onChange={(e) => set({ hooks: item.hooks.map((x, j) => (j === i ? e.target.value : x)) })}
                          className="w-full resize-none bg-transparent px-1 text-[13px] leading-relaxed text-ink focus:outline-none"
                        />
                        <div className="flex items-center justify-between px-1">
                          {chosen ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-good-text">
                              <Check className="size-3" /> Using this hook
                            </span>
                          ) : (
                            <button onClick={() => set({ chosenHook: i })} className="text-[11px] text-faint hover:text-ink">
                              Use this hook
                            </button>
                          )}
                          <button
                            onClick={() =>
                              set({
                                hooks: item.hooks.filter((_, j) => j !== i),
                                chosenHook: Math.max(0, item.chosenHook - (i <= item.chosenHook ? 1 : 0)),
                              })
                            }
                            className="text-[11px] text-ghost opacity-0 transition-opacity hover:text-critical-text group-hover:opacity-100"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
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
                  <input value={newHook} onChange={(e) => setNewHook(e.target.value)} placeholder="Add a hook" className={inputCls} />
                  <Button type="submit" size="icon" title="Add hook">
                    <Plus className="size-4" />
                  </Button>
                </form>
                <div className="pt-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted">Hook type</label>
                  <select value={item.hookType ?? ""} onChange={(e) => set({ hookType: e.target.value || undefined })} className={cx(selectCls, "w-full")} data-hook-type>
                    <option value="">Not tagged</option>
                    {HOOK_TYPES.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-faint">Analytics compares results by hook type, so you learn which ones land for your audience.</p>
                </div>
                <div className="pt-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted">On-screen overlay text</label>
                  <input
                    value={item.overlay}
                    onChange={(e) => set({ overlay: e.target.value })}
                    placeholder="The line on screen in the first two seconds"
                    className={inputCls}
                  />
                  <p className="mt-1.5 text-[11px] text-faint">Test variants as trial reels. The Hooks page has the routine.</p>
                </div>
                <Button variant="ai" onClick={() => askClaude("Give me 5 more hooks for this card. Different hook types. One per line.")}>
                  <Sparkles className="size-3.5" /> More hooks
                </Button>
              </>
            )}

            {tab === "script" && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <select value={item.scriptMode} onChange={(e) => set({ scriptMode: e.target.value as ScriptMode })} className={selectCls}>
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
                  placeholder="Write it how you'd say it, or have Claude draft it from your voice and fix it from there."
                  className={cx(inputCls, "leading-relaxed")}
                />
                <div className="flex items-center justify-between text-xs text-faint">
                  <span className="tabular-nums">
                    {words} words · about {seconds}s spoken
                  </span>
                </div>
                <LintPanel text={item.script} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ai"
                    onClick={() =>
                      askClaude(`Write the ${scriptModeLabel(item.scriptMode).toLowerCase()} script for this card in my voice. Open with the hook I'm using.`)
                    }
                  >
                    <Sparkles className="size-3.5" /> Draft with Claude
                  </Button>
                  <Button
                    disabled={!item.script.trim()}
                    onClick={() => askClaude("Read my script back and make it sound more like me and less like AI. Return only the new script.")}
                  >
                    Make it sound like me
                  </Button>
                  <Button onClick={() => askClaude("Interview me for this video. Ask one question at a time, then build the script from my answers.")}>
                    Interview me
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
                  variant="ai"
                  onClick={() =>
                    askClaude("Write the caption for this post. Short, sounds like me, ends with a reason to comment or share. Add 3 to 5 relevant hashtags.")
                  }
                >
                  <Sparkles className="size-3.5" /> Write caption
                </Button>
              </>
            )}

            {tab === "posts" && (
              <>
                {posts.length ? (
                  <ul className="divide-y divide-line rounded-lg border border-line" data-card-posts>
                    {posts.map((p) => {
                      const acc = accounts.find((a) => a.id === p.accountId);
                      return (
                        <li key={p.id}>
                          <button onClick={() => setOpenPost(p.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2">
                            <PlatformDot platform={p.platform} />
                            <span className="min-w-0 flex-1 truncate text-ink">{acc ? `@${acc.handle}` : platformLabel(p.platform)}</span>
                            <span className="tabular-nums text-faint">
                              {new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} {clockLabel(p.at)}
                            </span>
                            <span
                              className={cx(
                                "w-20 text-right",
                                p.status === "posted" ? "text-good-text" : p.status === "skipped" ? "text-ghost line-through" : "text-muted",
                              )}
                            >
                              {p.results?.views != null ? `${compact(p.results.views)} views` : p.status === "posted" ? "Posted" : p.status === "skipped" ? "Skipped" : "Planned"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs leading-relaxed text-faint">Not scheduled yet. Schedule it to one account or a whole group of clipping pages, at staggered times.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setScheduling(true)} data-card-schedule>
                    <CalendarPlus className="size-3.5" /> Schedule
                  </Button>
                  <Button onClick={() => setTesting(true)}>
                    <FlaskConical className="size-3.5" /> Test hooks as trial reels
                  </Button>
                </div>
              </>
            )}

            {tab === "notes" && (
              <>
                <textarea
                  value={item.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={6}
                  placeholder="Angle, references, shot ideas, proof to show"
                  className={inputCls}
                />
                <div>
                  <div className="mb-2 text-xs font-medium text-muted">Linked stories</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stories.map((st) => {
                      const on = item.storyIds.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          onClick={() =>
                            set({ storyIds: on ? item.storyIds.filter((x) => x !== st.id) : [...item.storyIds, st.id] })
                          }
                          className={cx(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                            on ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-ink",
                          )}
                        >
                          {on && <Check className="size-3" />}
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
      {prompter && <Teleprompter text={item.script || item.hooks[item.chosenHook] || ""} onClose={() => setPrompter(false)} />}
      {scheduling && <ScheduleDialog cardId={item.id} onClose={() => setScheduling(false)} />}
      {testing && <TestDialog cardId={item.id} onClose={() => setTesting(false)} />}
      {openPost && <PostDialog postId={openPost} onClose={() => setOpenPost(null)} />}
    </>
  );
}
