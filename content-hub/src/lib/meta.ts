import type { Format, Pillar, ScriptMode, StageId } from "./types";

export type Phase = "plan" | "make" | "ship" | "learn";

export const STAGES: { id: StageId; label: string; hint: string; phase: Phase }[] = [
  { id: "idea", label: "Idea", hint: "Captured, not started", phase: "plan" },
  { id: "research", label: "Researching", hint: "Angles, references, proof", phase: "plan" },
  { id: "scripting", label: "Scripting", hint: "Hooks and script", phase: "make" },
  { id: "ready", label: "Ready to record", hint: "Script locked", phase: "make" },
  { id: "recorded", label: "Recorded", hint: "Raw footage in", phase: "make" },
  { id: "editing", label: "Editing", hint: "Cut, captions, overlays", phase: "make" },
  { id: "review", label: "Review", hint: "Final check", phase: "make" },
  { id: "scheduled", label: "Scheduled", hint: "Queued to post", phase: "ship" },
  { id: "posted", label: "Posted", hint: "Live", phase: "ship" },
  { id: "analysed", label: "Analysed", hint: "Results logged", phase: "learn" },
];

export const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id);

export const stageLabel = (id: StageId) =>
  STAGES.find((s) => s.id === id)?.label ?? id;

export const PILLARS: { id: Pillar; label: string; blurb: string }[] = [
  {
    id: "business",
    label: "Business",
    blurb: "Meta ads, marketing, sales, leadership, running the agency",
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    blurb: "B-roll with text people relate to and repost",
  },
  {
    id: "personal",
    label: "Personal",
    blurb: "Life lessons, the accident, relationship, real talk",
  },
];

export const pillarLabel = (id: Pillar) =>
  PILLARS.find((p) => p.id === id)?.label ?? id;

/** Pillar identity colours. Text stays in ink; the dot carries the hue. */
export const PILLAR_STYLE: Record<Pillar, { dot: string; hex: string }> = {
  business: { dot: "bg-business", hex: "#3987e5" },
  lifestyle: { dot: "bg-lifestyle", hex: "#d95926" },
  personal: { dot: "bg-personal", hex: "#199e70" },
};

export const FORMATS: { id: Format; label: string }[] = [
  { id: "short", label: "Short form" },
  { id: "long", label: "YouTube long form" },
  { id: "broll", label: "Text on B-roll" },
  { id: "carousel", label: "Carousel" },
];

export const formatLabel = (id: Format) =>
  FORMATS.find((f) => f.id === id)?.label ?? id;

export const SCRIPT_MODES: { id: ScriptMode; label: string; shape: string }[] = [
  {
    id: "talking-short",
    label: "Talking head (short)",
    shape: "Hook, body, payoff, CTA. 30 to 60 seconds spoken.",
  },
  {
    id: "youtube-long",
    label: "YouTube long form",
    shape:
      "Title options, thumbnail concept, cold-open hook, outline with retention beats, B-roll cues.",
  },
  {
    id: "broll-overlay",
    label: "Text on B-roll",
    shape: "On-screen text only, a few short lines, plus a shot list for the B-roll.",
  },
  {
    id: "story",
    label: "Story",
    shape: "Drop into the moment, what happened, what changed, the lesson in plain words.",
  },
  {
    id: "bullets",
    label: "Talking points",
    shape: "Bullets only, so you say it in your own words on camera.",
  },
];

export const scriptModeLabel = (id: ScriptMode) =>
  SCRIPT_MODES.find((m) => m.id === id)?.label ?? id;
