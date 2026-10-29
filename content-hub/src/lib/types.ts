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
  /** The hook library type its hook is (research.json hookTypes id), for Analytics. */
  hookType?: string;
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

// ---------------------------------------------------------------------------
// Calendar, analytics and accounts (Phases 3 to 5). Each is a shared record
// collection, synced with the team like cards (lib/hubsync.ts).

export type Platform = "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin" | "x" | "threads";

/** A profile posted to: the main accounts and every clipping page. No logins are kept here. */
export interface Account {
  id: string;
  platform: Platform;
  /** Without the @. */
  handle: string;
  kind: "main" | "clipping";
  /** Clipping pages are scheduled by group: "IG clips A", "TikTok clips". */
  group: string;
  /** What it posts; empty means anything. */
  pillars: Pillar[];
  active: boolean;
  notes: string;
  /** The clipper who runs it; none means the team does. */
  clipperId?: string;
  /** "Account based in", from the app's About this account screen. */
  basedIn?: string;
  /** "Date joined" from the same screen, as the app shows it ("March 2026"). */
  joined?: string;
  followers?: number;
  /** The About this account screenshot it was read from. */
  proof?: string;
  /** When someone checked the screenshot and confirmed where it's based. */
  verifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** What a post did, typed in from the app's insights (or, later, pulled in). */
export interface PostResults {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  follows?: number;
  /** Average percentage of the video watched, 0 to 100. */
  avgWatch?: number;
  /** When these numbers were read, for "results at 48 hours" comparisons. */
  at: number;
}

/** One video going out on one account at one time: planned, then posted, then measured. */
/** A video in the footage library (Studio's Exports, usually) that a post is made from. */
export interface PostVideo {
  footageId: string;
  path: string;
  name: string;
}

export interface Post {
  id: string;
  cardId?: string;
  platform: Platform;
  accountId?: string;
  /** When it goes out (planned) or went out (posted). */
  at: number;
  status: "planned" | "posted" | "skipped";
  caption: string;
  /** The live post, once it's up. */
  url?: string;
  /** Posted as an Instagram trial reel (shown to non-followers first). */
  trial?: boolean;
  /** Part of an A/B test, as this variant. */
  testId?: string;
  variantId?: string;
  /** The trending sound to add in the app when posting. */
  soundId?: string;
  /** The exact file to post, when it isn't just the card's video (one version of a test, say). */
  video?: PostVideo;
  results?: PostResults;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** A weekly posting target, per platform and pillar ("any" for either). */
export interface Goal {
  id: string;
  platform: Platform | "any";
  pillar: Pillar | "any";
  perWeek: number;
  createdAt: number;
  updatedAt: number;
}

/** A batch recording session: scripts lined up to record back to back. */
export interface RecordingDay {
  id: string;
  /** Day key, 2026-10-30. */
  date: string;
  /** "10:00", or empty for any time. */
  time: string;
  title: string;
  /** In recording order. */
  cardIds: string[];
  /** Cards already recorded in this session. */
  recorded: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

/** The weekly review ritual: the numbers, what they said, and what's next. */
export interface Review {
  id: string;
  /** Monday's day key. */
  week: string;
  worked: string;
  didnt: string;
  learned: string;
  next: string;
  /** Claude's read of the week. */
  summary: string;
  createdAt: number;
  updatedAt: number;
}

export type TestVariable = "hook" | "overlay" | "caption" | "audio" | "thumbnail" | "length" | "other";
export type TestMetric = "views" | "avgWatch" | "shares" | "saves" | "follows";

/** A trial reel A/B test: one video, a few versions of one thing. */
export interface Test {
  id: string;
  cardId?: string;
  name: string;
  variable: TestVariable;
  /** What decides the winner. */
  metric: TestMetric;
  variants: { id: string; label: string; value: string; postId?: string; editId?: string }[];
  winner?: string;
  learned: string;
  status: "running" | "done";
  createdAt: number;
  updatedAt: number;
}

/** A trending sound spotted in the app, to add in-app at publish time. */
export interface Sound {
  id: string;
  name: string;
  artist: string;
  platform: Platform;
  url: string;
  status: "spotted" | "saved" | "used" | "faded";
  pillars: Pillar[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Clipping: people who run clipping pages, the clips sent to them, the posts
// they make, and paying them on verified United States views only.

/** Someone who runs clipping pages and is paid per 1,000 verified US views. */
export interface Clipper {
  id: string;
  name: string;
  /** Email, phone or handle to reach them. */
  contact: string;
  /** Where they live, as they told you. */
  country: string;
  /** Dollars per 1,000 verified US views. */
  cpm: number;
  status: "active" | "paused" | "removed";
  /** The secret in their portal link. A new one locks the old link out. */
  key: string;
  /** How they're paid ("PayPal: name@…"). Never bank details. */
  payoutNote: string;
  notes: string;
  /** When they agreed to the rules in their portal. */
  acceptedRulesAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** A clip sent out for clippers (and the team's own pages) to post. */
export interface Drop {
  id: string;
  title: string;
  /** The video in the footage library (usually Footage › Exports). */
  footageId?: string;
  cardId?: string;
  /** Hooks to put on screen; each clipper gets a different one first. */
  hooks: string[];
  /** Caption options; clippers take turns. */
  captions: string[];
  /** What to do and what not to: shown in every clipper's portal. */
  brief: string;
  platforms: Platform[];
  /** Overrides each clipper's own rate for this clip. */
  cpm?: number;
  /** Most paid for any one post of this clip, in dollars. */
  capPerPost?: number;
  /** All posts of this clip together, in dollars. */
  budget?: number;
  status: "live" | "ended";
  createdAt: number;
  updatedAt: number;
}

/** One reading of a post's numbers: from screenshots, typed in, or (later) the platform. */
export interface ViewSnapshot {
  at: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  /** Accounts reached. */
  reach?: number;
  /** Share of the audience in the United States, 0 to 1. */
  usShare?: number;
  topCountries?: { country: string; pct: number }[];
  /** The handle the screenshot shows, to check it's their account. */
  handle?: string;
  source: "screenshot" | "manual" | "api";
  /** Stored screenshot paths. */
  proofs?: string[];
  /** What didn't add up when the screenshots were read. */
  concerns?: string[];
}

/** One post a clipper made, with its proof, waiting to be checked and paid. */
export interface Submission {
  id: string;
  clipperId: string;
  dropId?: string;
  accountId?: string;
  platform: Platform;
  url: string;
  postedAt: number;
  snapshots: ViewSnapshot[];
  status: "pending" | "approved" | "rejected" | "paid";
  /** Verified US views, set when approved. */
  usViews?: number;
  /** Dollars, set when approved. */
  amount?: number;
  reviewNote?: string;
  payoutId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Money sent to a clipper for a set of approved posts. */
export interface Payout {
  id: string;
  clipperId: string;
  submissionIds: string[];
  usViews: number;
  amount: number;
  status: "owed" | "paid";
  paidAt?: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

/** The shared collections added with the calendar, analytics, accounts and clipping. */
export interface PlanRecords {
  accounts: Account;
  posts: Post;
  goals: Goal;
  days: RecordingDay;
  reviews: Review;
  tests: Test;
  sounds: Sound;
  clippers: Clipper;
  drops: Drop;
  submissions: Submission;
  payouts: Payout;
}
export type PlanCollection = keyof PlanRecords;
