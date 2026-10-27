"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type {
  ContentItem,
  Pillar,
  StageId,
  Story,
  SwipeItem,
  VoiceEntry,
} from "./types";
import type { SyncBase } from "./hubsync";
import { defaultOverlay, leadlabCaptions, youtubeCaptions, type Edit } from "./studio/types";
import { SEED_ITEMS, SEED_STORIES, SEED_VOICE } from "./seed";

// Where the pre-chat-list conversation waits for the chat store (lib/chats.ts)
// to pick it up. Kept in storage rather than memory: whichever copy of the
// app loads chats first (dev mode can run two) must still find it.
export const LEGACY_CHAT_KEY = "content-hub-legacy-chat";

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
  /** When the voice profile was last saved; the newest save wins across the team. */
  voiceProfileAt: number;
  swipe: SwipeItem[];
  /** Studio edits, shared like cards. */
  edits: Edit[];
  activityDays: string[];
  /** Team sync's record of what the server has (lib/sync.ts). */
  syncBase: SyncBase | null;

  // UI state (not persisted)
  openItemId: string | null;
  claudeOpen: boolean;
  paletteOpen: boolean;
  captureOpen: boolean;
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

  addEdit: (partial?: Partial<Edit>) => string;
  /** Changes an edit; pass a function to change it from its latest state. */
  updateEdit: (id: string, patch: Partial<Edit> | ((e: Edit) => Partial<Edit>)) => void;
  deleteEdit: (id: string) => void;

  openItem: (id: string | null) => void;
  setClaudeOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setCaptureOpen: (open: boolean) => void;
  askClaude: (prompt: string) => void;
  takePendingPrompt: () => string | null;
}

const markActive = (days: string[]) =>
  days.includes(today()) ? days : [...days, today()].slice(-400);

const initialData = () => ({
  items: SEED_ITEMS,
  stories: SEED_STORIES,
  voiceEntries: SEED_VOICE,
  voiceProfile: "",
  voiceProfileAt: 0,
  swipe: [] as SwipeItem[],
  edits: [] as Edit[],
  activityDays: [] as string[],
});

/** The parts of the hub that are saved and shared, as opposed to what's open on screen. */
export type HubContent = ReturnType<typeof initialData>;

/** What Reset goes back to. */
export const starterContent = initialData;

// Stories, voice notes and swipe items saved before team sync had no
// updatedAt; their creation time stands in for it.
const stamped = <T extends { createdAt: number; updatedAt?: number }>(list: unknown) =>
  Array.isArray(list) ? (list as T[]).map((x) => (x.updatedAt ? x : { ...x, updatedAt: x.createdAt })) : undefined;

/** Brings saved or backed-up data up to the current shape. */
export function normalize(data: Record<string, unknown>): Partial<HubContent> {
  const out = { ...data } as Partial<HubContent>;
  if (data.stories) out.stories = stamped<Story>(data.stories);
  if (data.voiceEntries) out.voiceEntries = stamped<VoiceEntry>(data.voiceEntries);
  if (data.swipe) out.swipe = stamped<SwipeItem>(data.swipe);
  if (typeof data.voiceProfile === "string" && typeof data.voiceProfileAt !== "number") {
    // A profile from before sync counts as older than any saved since.
    out.voiceProfileAt = data.voiceProfile ? 1 : 0;
  }
  return out;
}

export const useHub = create<HubState>()(
  persist(
    (set, get) => ({
      ...initialData(),
      syncBase: null,
      openItemId: null,
      claudeOpen: false,
      paletteOpen: false,
      captureOpen: false,
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
          stageHistory: [{ stage: partial.stage ?? "idea", at: now }],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ items: [item, ...s.items], activityDays: markActive(s.activityDays) }));
        return id;
      },
      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== id) return i;
            const now = Date.now();
            const moved = patch.stage && patch.stage !== i.stage;
            return {
              ...i,
              ...patch,
              stageHistory: moved
                ? [...(i.stageHistory ?? []), { stage: patch.stage!, at: now }]
                : i.stageHistory,
              updatedAt: now,
            };
          }),
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
          updatedAt: Date.now(),
        };
        set((s) => ({ stories: [story, ...s.stories], activityDays: markActive(s.activityDays) }));
        return id;
      },
      updateStory: (id, patch) =>
        set((s) => ({ stories: s.stories.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)) })),
      deleteStory: (id) => set((s) => ({ stories: s.stories.filter((x) => x.id !== id) })),

      addVoiceEntry: (text, source) =>
        set((s) => ({
          voiceEntries: [{ id: uid(), text, source, createdAt: Date.now(), updatedAt: Date.now() }, ...s.voiceEntries],
          activityDays: markActive(s.activityDays),
        })),
      deleteVoiceEntry: (id) =>
        set((s) => ({ voiceEntries: s.voiceEntries.filter((v) => v.id !== id) })),
      setVoiceProfile: (voiceProfile) => set({ voiceProfile, voiceProfileAt: Date.now() }),

      addSwipe: (url, note) =>
        set((s) => ({ swipe: [{ id: uid(), url, note, createdAt: Date.now(), updatedAt: Date.now() }, ...s.swipe] })),
      deleteSwipe: (id) => set((s) => ({ swipe: s.swipe.filter((x) => x.id !== id) })),

      addEdit: (partial) => {
        const id = uid();
        const now = Date.now();
        const edit: Edit = {
          title: "Untitled edit",
          aspect: "9:16",
          clips: [],
          captions: partial?.aspect === "16:9" ? youtubeCaptions() : leadlabCaptions(),
          captionText: {},
          overlay: defaultOverlay(),
          ...partial,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ edits: [edit, ...s.edits], activityDays: markActive(s.activityDays) }));
        return id;
      },
      updateEdit: (id, patch) =>
        set((s) => ({
          edits: s.edits.map((e) =>
            e.id === id ? { ...e, ...(typeof patch === "function" ? patch(e) : patch), updatedAt: Date.now() } : e,
          ),
          activityDays: markActive(s.activityDays),
        })),
      deleteEdit: (id) => set((s) => ({ edits: s.edits.filter((e) => e.id !== id) })),

      openItem: (openItemId) => set({ openItemId }),
      setClaudeOpen: (claudeOpen) => set({ claudeOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setCaptureOpen: (captureOpen) => set({ captureOpen }),
      askClaude: (prompt) => set({ claudeOpen: true, pendingPrompt: prompt }),
      takePendingPrompt: () => {
        const p = get().pendingPrompt;
        if (p) set({ pendingPrompt: null });
        return p;
      },

    }),
    {
      name: "content-hub-v1",
      skipHydration: true,
      partialize: (s) => ({
        items: s.items,
        stories: s.stories,
        voiceEntries: s.voiceEntries,
        voiceProfile: s.voiceProfile,
        voiceProfileAt: s.voiceProfileAt,
        swipe: s.swipe,
        edits: s.edits,
        activityDays: s.activityDays,
        syncBase: s.syncBase,
      }),
      // Chats moved to their own store (lib/chats.ts). The old single chat is
      // handed over once, the first time the new store loads.
      merge: (persisted, current) => {
        const saved = { ...((persisted ?? {}) as Record<string, unknown>) };
        if (Array.isArray(saved.chat) && saved.chat.length) {
          try {
            localStorage.setItem(LEGACY_CHAT_KEY, JSON.stringify(saved.chat));
          } catch {}
        }
        delete saved.chat;
        return { ...current, ...normalize(saved) };
      },
    },
  ),
);

/** A downloaded backup as hub content; anything it lacks stays as it is now. */
export function backupContent(raw: Record<string, unknown>): HubContent {
  const d = normalize(raw);
  const s = useHub.getState();
  return {
    items: d.items ?? s.items,
    stories: d.stories ?? s.stories,
    voiceEntries: d.voiceEntries ?? s.voiceEntries,
    voiceProfile: d.voiceProfile ?? s.voiceProfile,
    voiceProfileAt: Date.now(),
    swipe: d.swipe ?? s.swipe,
    edits: d.edits ?? s.edits,
    activityDays: d.activityDays ?? s.activityDays,
  };
}

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
