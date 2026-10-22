"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type {
  ChatMessage,
  ContentItem,
  Pillar,
  StageId,
  Story,
  SwipeItem,
  VoiceEntry,
} from "./types";
import { SEED_ITEMS, SEED_STORIES, SEED_VOICE } from "./seed";

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Local-date key like 2026-10-22. */
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const today = () => dayKey();

interface HubState {
  items: ContentItem[];
  stories: Story[];
  voiceEntries: VoiceEntry[];
  voiceProfile: string;
  swipe: SwipeItem[];
  chat: ChatMessage[];
  activityDays: string[];

  // UI state (not persisted)
  openItemId: string | null;
  claudeOpen: boolean;
  paletteOpen: boolean;
  /** A prompt queued for the Claude panel to send as soon as it opens. */
  pendingPrompt: string | null;

  addItem: (partial: Partial<ContentItem> & { title: string; pillar: Pillar }) => string;
  updateItem: (id: string, patch: Partial<ContentItem>) => void;
  moveItem: (id: string, stage: StageId) => void;
  deleteItem: (id: string) => void;

  addStory: (partial?: Partial<Story>) => string;
  updateStory: (id: string, patch: Partial<Story>) => void;
  deleteStory: (id: string) => void;

  addVoiceEntry: (text: string, source: VoiceEntry["source"]) => void;
  deleteVoiceEntry: (id: string) => void;
  setVoiceProfile: (text: string) => void;

  addSwipe: (url: string, note: string) => void;
  deleteSwipe: (id: string) => void;

  pushChat: (msg: ChatMessage) => void;
  patchChat: (id: string, content: string) => void;
  clearChat: () => void;

  openItem: (id: string | null) => void;
  setClaudeOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  askClaude: (prompt: string) => void;
  takePendingPrompt: () => string | null;

  importData: (data: Partial<HubState>) => void;
  resetAll: () => void;
}

const markActive = (days: string[]) =>
  days.includes(today()) ? days : [...days, today()].slice(-400);

const initialData = () => ({
  items: SEED_ITEMS,
  stories: SEED_STORIES,
  voiceEntries: SEED_VOICE,
  voiceProfile: "",
  swipe: [] as SwipeItem[],
  chat: [] as ChatMessage[],
  activityDays: [] as string[],
});

export const useHub = create<HubState>()(
  persist(
    (set, get) => ({
      ...initialData(),
      openItemId: null,
      claudeOpen: false,
      paletteOpen: false,
      pendingPrompt: null,

      addItem: (partial) => {
        const id = uid();
        const now = Date.now();
        const item: ContentItem = {
          format: "short",
          stage: "idea",
          hooks: [],
          chosenHook: 0,
          overlay: "",
          scriptMode: partial.pillar === "lifestyle" ? "broll-overlay" : "talking-short",
          script: "",
          caption: "",
          notes: "",
          storyIds: [],
          ...partial,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ items: [item, ...s.items], activityDays: markActive(s.activityDays) }));
        return id;
      },
      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
          activityDays: markActive(s.activityDays),
        })),
      moveItem: (id, stage) => get().updateItem(id, { stage }),
      deleteItem: (id) =>
        set((s) => ({
          items: s.items.filter((i) => i.id !== id),
          openItemId: s.openItemId === id ? null : s.openItemId,
        })),

      addStory: (partial) => {
        const id = uid();
        const story: Story = {
          title: "Untitled story",
          whatHappened: "",
          lesson: "",
          themes: [],
          questions: [],
          ...partial,
          id,
          createdAt: Date.now(),
        };
        set((s) => ({ stories: [story, ...s.stories], activityDays: markActive(s.activityDays) }));
        return id;
      },
      updateStory: (id, patch) =>
        set((s) => ({ stories: s.stories.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteStory: (id) => set((s) => ({ stories: s.stories.filter((x) => x.id !== id) })),

      addVoiceEntry: (text, source) =>
        set((s) => ({
          voiceEntries: [{ id: uid(), text, source, createdAt: Date.now() }, ...s.voiceEntries],
          activityDays: markActive(s.activityDays),
        })),
      deleteVoiceEntry: (id) =>
        set((s) => ({ voiceEntries: s.voiceEntries.filter((v) => v.id !== id) })),
      setVoiceProfile: (voiceProfile) => set({ voiceProfile }),

      addSwipe: (url, note) =>
        set((s) => ({ swipe: [{ id: uid(), url, note, createdAt: Date.now() }, ...s.swipe] })),
      deleteSwipe: (id) => set((s) => ({ swipe: s.swipe.filter((x) => x.id !== id) })),

      pushChat: (msg) => set((s) => ({ chat: [...s.chat, msg] })),
      patchChat: (id, content) =>
        set((s) => ({ chat: s.chat.map((m) => (m.id === id ? { ...m, content } : m)) })),
      clearChat: () => set({ chat: [] }),

      openItem: (openItemId) => set({ openItemId }),
      setClaudeOpen: (claudeOpen) => set({ claudeOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      askClaude: (prompt) => set({ claudeOpen: true, pendingPrompt: prompt }),
      takePendingPrompt: () => {
        const p = get().pendingPrompt;
        if (p) set({ pendingPrompt: null });
        return p;
      },

      importData: (data) =>
        set({
          items: data.items ?? get().items,
          stories: data.stories ?? get().stories,
          voiceEntries: data.voiceEntries ?? get().voiceEntries,
          voiceProfile: data.voiceProfile ?? get().voiceProfile,
          swipe: data.swipe ?? get().swipe,
          activityDays: data.activityDays ?? get().activityDays,
        }),
      resetAll: () => set({ ...initialData(), openItemId: null }),
    }),
    {
      name: "content-hub-v1",
      skipHydration: true,
      partialize: (s) => ({
        items: s.items,
        stories: s.stories,
        voiceEntries: s.voiceEntries,
        voiceProfile: s.voiceProfile,
        swipe: s.swipe,
        chat: s.chat.slice(-60),
        activityDays: s.activityDays,
      }),
    },
  ),
);

/** Loads saved data from the browser once, then reports ready. */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const done = () => setReady(true);
    if (useHub.persist.hasHydrated()) done();
    else {
      const unsub = useHub.persist.onFinishHydration(done);
      useHub.persist.rehydrate();
      return unsub;
    }
  }, []);
  return ready;
}

/** Consecutive days (ending today or yesterday) with any activity. */
export function streakFrom(days: string[]) {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
