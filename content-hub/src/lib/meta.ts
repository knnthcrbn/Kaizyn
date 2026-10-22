import type { Format, Pillar, ScriptMode, StageId } from "./types";

export const STAGES: { id: StageId; label: string; hint: string }[] = [
  { id: "idea", label: "Idea", hint: "Captured, not started" },
  { id: "research", label: "Researching", hint: "Angles, references, proof" },
  { id: "scripting", label: "Scripting", hint: "Hooks and script" },
  { id: "ready", label: "Ready to record", hint: "Script locked" },
  { id: "recorded", label: "Recorded", hint: "Raw footage in" },
  { id: "editing", label: "Editing", hint: "Cut, captions, overlays" },
  { id: "review", label: "Review", hint: "Final check" },
  { id: "scheduled", label: "Scheduled", hint: "Queued to post" },
  { id: "posted", label: "Posted", hint: "Live" },
  { id: "analysed", label: "Analysed", hint: "Results logged" },
];

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

/** Tailwind classes per pillar. Written out in full so Tailwind can see them. */
export const PILLAR_STYLE: Record<Pillar, { text: string; bg: string; dot: string }> = {
  business: { text: "text-business", bg: "bg-business/10", dot: "bg-business" },
  lifestyle: { text: "text-lifestyle", bg: "bg-lifestyle/10", dot: "bg-lifestyle" },
  personal: { text: "text-personal", bg: "bg-personal/10", dot: "bg-personal" },
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
