"use client";

import { create } from "zustand";
import { createStore, del as idbDel, get as idbGet, set as idbSet, values } from "idb-keyval";
import type { Chat, ChatAttachment, ChatMessage, ChatSource } from "./types";
import { DEFAULT_EFFORT, DEFAULT_MODEL, estimateCost, isEffort, isModel, type Effort, type ModelId } from "./models";
import { contextParts, sampleClaude, streamChat, type WireMessage } from "./claude";
import { IN_CLAUDE } from "./platform";
import { LEGACY_CHAT_KEY, uid } from "./store";

// Claude conversations. They live in IndexedDB rather than localStorage with
// the rest of the hub: a few long chats with thinking and sources would
// outgrow localStorage's ~5 MB, and IndexedDB stores objects without the
// JSON round trip on every save.

const MAX_CHATS = 200;
/** askClaude keeps using the open chat if it was touched this recently. */
const FRESH_MS = 2 * 60 * 60 * 1000;

export interface ChatOptions {
  model: ModelId;
  effort: Effort;
  web: boolean;
  hub: boolean;
}

interface ChatsState {
  /** Most recently used first. */
  chats: Chat[];
  activeId: string | null;
  /** What a new chat starts with: whatever was used last. */
  defaults: ChatOptions;
  loaded: boolean;
  /** chat id -> id of the reply being written. Not saved. */
  streaming: Record<string, string>;
}

export const useChats = create<ChatsState>(() => ({
  chats: [],
  activeId: null,
  defaults: { model: DEFAULT_MODEL, effort: DEFAULT_EFFORT, web: true, hub: true },
  loaded: false,
  streaming: {},
}));

/** A reply while it streams. Kept apart from the saved chats so a token doesn't re-save every chat. */
export interface Live {
  text: string;
  thinking: string;
  thinkingStart?: number;
  thinkingMs?: number;
  searches: string[];
  sources: ChatSource[];
  model?: string;
}

export const useLive = create<Record<string, Live>>(() => ({}));

const controllers = new Map<string, AbortController>();

// ---------------------------------------------------------------- persistence

// One IndexedDB entry per chat, written only when that chat changes. Two tabs
// (or a reload mid-save) then can't overwrite each other's conversations the
// way one big saved list would.
const chatStore = typeof indexedDB === "undefined" ? undefined : createStore("content-hub", "chats");
const META = "content-hub-chats-meta-v1";

let loading: Promise<void> | null = null;

/** Loads saved chats once. Call after the hub store has hydrated (for the legacy handover). */
export function loadChats() {
  loading ??= (async () => {
    let chats: Chat[] = [];
    let meta: Pick<ChatsState, "activeId" | "defaults"> | undefined;
    try {
      [chats, meta] = await Promise.all([values<Chat>(chatStore), idbGet(META)]);
    } catch {
      // Private windows can refuse IndexedDB; chats then last for the visit.
    }
    const saved = new Map<string, Chat>(chats.map((c) => [c.id, c]));

    // A reply that was mid-stream when the tab closed is as far as it got.
    chats = chats
      .map((c) =>
        c.messages.some((m) => m.status === "streaming")
          ? { ...c, messages: c.messages.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" as const } : m)) }
          : c,
      )
      .sort((x, y) => y.updatedAt - x.updatedAt);

    // The single chat from before the chat list becomes a saved chat.
    let legacy: { id: string; role: "user" | "assistant"; content: string }[] | null = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_CHAT_KEY) ?? "null");
    } catch {}
    if (legacy?.length && !saved.has(`legacy-${legacy[0].id}`)) {
      const chat = blankChat(useChats.getState().defaults);
      chat.id = `legacy-${legacy[0].id}`;
      chat.title = titleFrom(legacy.find((m) => m.role === "user")?.content ?? "");
      chat.messages = legacy.map((m) => ({ id: m.id, role: m.role, content: m.content, status: "done" as const }));
      chats = [chat, ...chats];
    }

    const d = meta?.defaults;
    useChats.setState({
      chats,
      activeId: meta?.activeId && chats.some((c) => c.id === meta.activeId) ? meta.activeId : (chats[0]?.id ?? null),
      defaults: {
        ...useChats.getState().defaults,
        ...d,
        model: isModel(d?.model) ? d.model : DEFAULT_MODEL,
        effort: isEffort(d?.effort) ? d.effort : DEFAULT_EFFORT,
      },
      loaded: true,
    });

    const save = async () => {
      const s = useChats.getState();
      const writes: Promise<void>[] = [idbSet(META, { activeId: s.activeId, defaults: s.defaults })];
      const live = new Set<string>();
      for (const c of s.chats) {
        live.add(c.id);
        // Empty chats aren't worth keeping across visits.
        if (c.messages.length && saved.get(c.id) !== c) {
          saved.set(c.id, c);
          writes.push(idbSet(c.id, c, chatStore));
        }
      }
      for (const id of [...saved.keys()]) {
        if (!live.has(id)) {
          saved.delete(id);
          writes.push(idbDel(id, chatStore));
        }
      }
      await Promise.all(writes);
    };
    if (legacy?.length) {
      // Only forget the old chat once it's safely in the new store.
      save()
        .then(() => localStorage.removeItem(LEGACY_CHAT_KEY))
        .catch(() => {});
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    useChats.subscribe((s, prev) => {
      if (s.chats === prev.chats && s.activeId === prev.activeId && s.defaults === prev.defaults) return;
      clearTimeout(timer);
      timer = setTimeout(() => save().catch(() => {}), 400);
    });
  })();
  return loading;
}

// ---------------------------------------------------------------- chat list

function blankChat(o: ChatOptions): Chat {
  const now = Date.now();
  return { id: uid(), title: "New chat", createdAt: now, updatedAt: now, messages: [], ...o };
}

const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t ? (t.length > 60 ? `${t.slice(0, 57)}…` : t) : "New chat";
};

const patchChat = (id: string, fn: (c: Chat) => Chat) =>
  useChats.setState((s) => ({ chats: s.chats.map((c) => (c.id === id ? fn(c) : c)) }));

const patchMessage = (chatId: string, msgId: string, patch: Partial<ChatMessage>) =>
  patchChat(chatId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }));

/** Opens an empty chat, reusing one that's already empty. */
export function newChat() {
  const s = useChats.getState();
  const empty = s.chats.find((c) => c.messages.length === 0);
  if (empty) {
    useChats.setState({ activeId: empty.id });
    return empty.id;
  }
  const chat = blankChat(s.defaults);
  useChats.setState({ chats: [chat, ...s.chats].slice(0, MAX_CHATS), activeId: chat.id });
  return chat.id;
}

export const selectChat = (id: string | null) => useChats.setState({ activeId: id });

export const renameChat = (id: string, title: string) => patchChat(id, (c) => ({ ...c, title: title.trim() || c.title }));

export function deleteChat(id: string) {
  controllers.get(id)?.abort();
  useChats.setState((s) => ({
    chats: s.chats.filter((c) => c.id !== id),
    activeId: s.activeId === id ? null : s.activeId,
  }));
}

/** Model, effort, web and hub context for one chat (and the default for the next). */
export function setChatOptions(id: string | null, patch: Partial<ChatOptions>) {
  useChats.setState((s) => ({ defaults: { ...s.defaults, ...patch } }));
  if (id) patchChat(id, (c) => ({ ...c, ...patch }));
}

export const activeChat = () => {
  const s = useChats.getState();
  return s.chats.find((c) => c.id === s.activeId) ?? null;
};

/** The chat askClaude() should talk in: the open one if it's recent and idle, else a fresh one. */
export function chatForQuickAsk() {
  const s = useChats.getState();
  const c = activeChat();
  if (c && !s.streaming[c.id] && (c.messages.length === 0 || Date.now() - c.updatedAt < FRESH_MS)) return c.id;
  return newChat();
}

/** Estimated spend on replies this calendar month. */
export function monthSpend() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  let total = 0;
  let replies = 0;
  for (const c of useChats.getState().chats)
    for (const m of c.messages)
      if (m.cost && (m.createdAt ?? c.updatedAt) >= start.getTime()) {
        total += m.cost;
        replies++;
      }
  return { total, replies };
}

// ---------------------------------------------------------------- talking

/** Sends a message in a chat (a new one if none) and streams the reply. */
export async function sendMessage(chatId: string | null, text: string, attachments: ChatAttachment[], page: string) {
  let id = chatId && useChats.getState().chats.some((c) => c.id === chatId) ? chatId : newChat();
  if (useChats.getState().streaming[id]) return;
  const chat = useChats.getState().chats.find((c) => c.id === id)!;

  const msg: ChatMessage = {
    id: uid(),
    role: "user",
    content: text.trim(),
    createdAt: Date.now(),
    ...(attachments.length ? { attachments } : {}),
  };
  let contextSent = chat.contextSent;
  if (chat.hub && !IN_CLAUDE) {
    const { full, lite } = contextParts(page);
    const lastLite = [...chat.messages].reverse().find((m) => m.lite != null)?.lite;
    const parts: string[] = [];
    if (!contextSent && full) parts.push(full);
    if (lite && lite !== lastLite) {
      parts.push(lite);
      msg.lite = lite;
    }
    if (parts.length) msg.context = parts.join("\n\n");
    contextSent = contextSent || !!full;
  }

  patchChat(id, (c) => ({
    ...c,
    title: c.messages.length ? c.title : titleFrom(text || attachments[0]?.name || ""),
    messages: [...c.messages, msg],
    contextSent,
    updatedAt: Date.now(),
  }));
  // Most recently used first.
  useChats.setState((s) => ({ chats: [s.chats.find((c) => c.id === id)!, ...s.chats.filter((c) => c.id !== id)] }));
  id = await reply(id, page);
  return id;
}

/** Throws away the last reply and asks again. */
export function retryLast(chatId: string, page: string) {
  if (useChats.getState().streaming[chatId]) return;
  patchChat(chatId, (c) => {
    const messages = [...c.messages];
    while (messages.length && messages[messages.length - 1].role === "assistant") messages.pop();
    return { ...c, messages };
  });
  return reply(chatId, page);
}

export const stopChat = (chatId: string) => controllers.get(chatId)?.abort();

function toWire(m: ChatMessage): WireMessage | null {
  if (m.role === "user") {
    return {
      role: "user",
      text: m.content,
      context: m.context,
      attachments: m.attachments?.map(({ kind, name, fileId, text }) => ({ kind, name, fileId, text })),
    };
  }
  // A failed reply was never part of the conversation.
  if (m.status === "error" || !m.content.trim()) return null;
  return { role: "assistant", text: m.content };
}

async function reply(chatId: string, page: string) {
  const chat = useChats.getState().chats.find((c) => c.id === chatId);
  if (!chat || chat.messages[chat.messages.length - 1]?.role !== "user") return chatId;

  const out: ChatMessage = {
    id: uid(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    model: chat.model,
    effort: chat.effort,
    status: "streaming",
  };
  const history = chat.messages;
  patchChat(chatId, (c) => ({ ...c, messages: [...c.messages, out], updatedAt: Date.now() }));
  useChats.setState((s) => ({ streaming: { ...s.streaming, [chatId]: out.id } }));
  useLive.setState({ [out.id]: { text: "", thinking: "", searches: [], sources: [] } });
  const live = (fn: (l: Live) => Partial<Live>) =>
    useLive.setState((s) => (s[out.id] ? { [out.id]: { ...s[out.id], ...fn(s[out.id]) } } : {}));

  const ac = new AbortController();
  controllers.set(chatId, ac);
  const final: Partial<ChatMessage> = { status: "done" };

  try {
    if (IN_CLAUDE) {
      // claude.ai's sample capability: plain text, no model choice or tools.
      await sampleClaude(
        history.filter((m) => m.content.trim() && m.status !== "error").map((m) => ({ role: m.role, content: m.content })),
        page,
        (text) => live(() => ({ text })),
        ac.signal,
      );
    } else {
      await streamChat(
        {
          messages: history.map(toWire).filter((m): m is WireMessage => !!m),
          model: chat.model,
          effort: chat.effort,
          web: chat.web,
        },
        (e) => {
          switch (e.t) {
            case "model":
              return live(() => ({ model: e.model }));
            case "thinking":
              return live((l) => ({ thinking: l.thinking + e.d, thinkingStart: l.thinkingStart ?? Date.now() }));
            case "text":
              return live((l) => ({
                text: l.text + e.d,
                thinkingMs: l.thinkingMs ?? (l.thinkingStart ? Date.now() - l.thinkingStart : undefined),
              }));
            case "search":
              return live((l) => ({ searches: [...l.searches, e.q] }));
            case "fetch":
              return live((l) => ({ searches: [...l.searches, e.url] }));
            case "source":
              return live((l) =>
                l.sources.some((x) => x.url === e.url) ? {} : { sources: [...l.sources, { url: e.url, title: e.title }] },
              );
            case "note":
              return live((l) => ({ text: `${l.text}\n\n_${e.d}_` }));
            case "done":
              final.usage = e.usage;
              final.cost = estimateCost(e.model, e.usage);
              if (isModel(e.model)) final.model = e.model;
              return;
            case "error":
              final.status = "error";
              final.error = e.message;
              return;
          }
        },
        ac.signal,
      );
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") final.status = "stopped";
    else {
      final.status = "error";
      final.error = "Couldn't reach the hub's server. Check your connection and try again.";
    }
  } finally {
    const l = useLive.getState()[out.id];
    if (l) {
      final.content = l.text;
      if (l.thinking) {
        final.thinking = l.thinking;
        final.thinkingMs = l.thinkingMs ?? (l.thinkingStart ? Date.now() - l.thinkingStart : undefined);
      }
      if (l.searches.length) final.searches = l.searches;
      if (l.sources.length) final.sources = l.sources;
    }
    patchMessage(chatId, out.id, final);
    patchChat(chatId, (c) => ({ ...c, updatedAt: Date.now() }));
    controllers.delete(chatId);
    useChats.setState((s) => {
      const streaming = { ...s.streaming };
      delete streaming[chatId];
      return { streaming };
    });
    useLive.setState((s) => {
      const next = { ...s };
      delete next[out.id];
      return next;
    }, true);
  }
  return chatId;
}

// ---------------------------------------------------------------- backup

export const exportChats = () => useChats.getState().chats;

export function importChats(chats: unknown) {
  if (!Array.isArray(chats)) return;
  useChats.setState({ chats: (chats as Chat[]).slice(0, MAX_CHATS), activeId: null });
}

export function clearChats() {
  for (const c of controllers.values()) c.abort();
  useChats.setState({ chats: [], activeId: null });
}
