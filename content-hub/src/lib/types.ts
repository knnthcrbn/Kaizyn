import type { Effort, ModelId, Usage } from "./models";

export type Pillar = "business" | "lifestyle" | "personal";

export type Format = "short" | "long" | "broll" | "carousel";

export type StageId =
  | "idea"
  | "research"
  | "scripting"
  | "ready"
  | "recorded"
  | "editing"
  | "review"
  | "scheduled"
  | "posted"
  | "analysed";

export type ScriptMode =
  | "talking-short"
  | "youtube-long"
  | "broll-overlay"
  | "story"
  | "bullets";

export interface ContentItem {
  id: string;
  title: string;
  pillar: Pillar;
  format: Format;
  stage: StageId;
  hooks: string[];
  chosenHook: number;
  overlay: string;
  scriptMode: ScriptMode;
  script: string;
  caption: string;
  notes: string;
  storyIds: string[];
  dueDate?: string;
  /** When the card entered each stage. Drives the week-over-week numbers. */
  stageHistory?: { stage: StageId; at: number }[];
  createdAt: number;
  updatedAt: number;
}

export interface Story {
  id: string;
  title: string;
  whatHappened: string;
  lesson: string;
  themes: string[];
  /** Prompts to help tell a story that hasn't been captured yet. */
  questions: string[];
  createdAt: number;
  updatedAt: number;
}

export interface VoiceEntry {
  id: string;
  text: string;
  source: "recording" | "typed" | "seed";
  createdAt: number;
  updatedAt: number;
}

export interface SwipeItem {
  id: string;
  url: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatAttachment {
  id: string;
  name: string;
  kind: "image" | "pdf" | "text";
  mediaType: string;
  size: number;
  /** Images and PDFs are uploaded once to Anthropic's Files API and sent by id. */
  fileId?: string;
  /** Text files are small enough to send inline. */
  text?: string;
  /** A small preview for images, as a data URL. */
  thumb?: string;
}

export interface ChatSource {
  url: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
  attachments?: ChatAttachment[];
  /**
   * The hub context sent ahead of this message, kept so the conversation
   * replays byte-for-byte on later turns (that is what keeps it cached).
   */
  context?: string;
  /** The page-and-card part of that context, to tell when it changed. */
  lite?: string;
  thinking?: string;
  thinkingMs?: number;
  searches?: string[];
  sources?: ChatSource[];
  model?: ModelId;
  effort?: Effort;
  usage?: Usage;
  cost?: number;
  status?: "streaming" | "done" | "stopped" | "error";
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  model: ModelId;
  effort: Effort;
  /** Let Claude search and read the web. */
  web: boolean;
  /** Send the creator's voice, stories and open card along. */
  hub: boolean;
  /** The voice/stories part of the hub context has gone out in this chat. */
  contextSent?: boolean;
}
