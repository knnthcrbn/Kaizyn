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
}

export interface VoiceEntry {
  id: string;
  text: string;
  source: "recording" | "typed" | "seed";
  createdAt: number;
}

export interface SwipeItem {
  id: string;
  url: string;
  note: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
