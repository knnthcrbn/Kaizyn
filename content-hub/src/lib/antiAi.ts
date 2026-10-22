/**
 * Phrases and patterns that make a script sound generated. Every script in the
 * hub is checked against this list, and Claude is told to avoid all of it.
 */
export interface AntiAiRule {
  id: string;
  label: string;
  pattern: RegExp;
  why: string;
}

export const ANTI_AI_RULES: AntiAiRule[] = [
  { id: "em-dash", label: "Em dash (—)", pattern: /—/g, why: "Nobody talks in em dashes. Use a period or a comma." },
  { id: "todays-world", label: "“In today's world / fast-paced…”", pattern: /\bin today'?s (?:world|fast[- ]paced|digital|day and age)/gi, why: "Classic AI opener." },
  { id: "dive", label: "“Dive in / deep dive / delve”", pattern: /\b(?:let'?s dive|dive (?:in|into)|deep dive|delve)\b/gi, why: "Sounds like a blog post, not a person." },
  { id: "game-changer", label: "“Game-changer”", pattern: /\bgame[- ]?changer\b/gi, why: "Overused to the point of meaning nothing." },
  { id: "unlock", label: "“Unlock / unleash”", pattern: /\b(?:unlock|unleash)(?:s|ed|ing)?\b/gi, why: "Marketing-speak." },
  { id: "elevate", label: "“Elevate / supercharge / level up”", pattern: /\b(?:elevate|supercharge|level up)(?:s|d|ing)?\b/gi, why: "Hype words that read as AI." },
  { id: "heres-the-thing", label: "“Here's the thing / the truth is”", pattern: /\b(?:here'?s the thing|the truth is|here'?s the kicker|plot twist)\b/gi, why: "Fake suspense filler." },
  { id: "not-about", label: "“It's not about X, it's about Y”", pattern: /\bit'?s not (?:just )?about [^.?!\n]{1,60}[,;] it'?s about\b/gi, why: "The most recognisable AI sentence shape." },
  { id: "landscape", label: "“Landscape / navigate / journey”", pattern: /\b(?:landscape|navigat(?:e|ing) the|your journey|this journey)\b/gi, why: "Corporate filler." },
  { id: "fancy", label: "Fancy words (crucial, pivotal, seamless, robust…)", pattern: /\b(?:crucial|pivotal|seamless(?:ly)?|robust|tapestry|testament|transformative|empower(?:ing)?|harness|embark|realm|foster)\b/gi, why: "Words people don't say out loud." },
  { id: "transitions", label: "Essay transitions (moreover, furthermore…)", pattern: /\b(?:moreover|furthermore|additionally|in conclusion|ultimately|in essence)\b/gi, why: "Written-essay glue." },
  { id: "sink-in", label: "“Let that sink in / buckle up”", pattern: /\b(?:let that sink in|buckle up|without further ado|imagine a world)\b/gi, why: "Cringe filler." },
  { id: "stop-scrolling", label: "“Stop scrolling”", pattern: /\bstop scrolling\b/gi, why: "Overused hook. People scroll faster." },
];

export interface LintHit {
  rule: AntiAiRule;
  count: number;
  samples: string[];
}

export function lintScript(text: string): LintHit[] {
  if (!text.trim()) return [];
  const hits: LintHit[] = [];
  for (const rule of ANTI_AI_RULES) {
    const matches = text.match(rule.pattern);
    if (matches?.length) {
      hits.push({
        rule,
        count: matches.length,
        samples: Array.from(new Set(matches.map((m) => m.trim()))).slice(0, 3),
      });
    }
  }
  return hits;
}

/** A plain-text version of the rules, sent to Claude with every request. */
export const ANTI_AI_BRIEF = [
  "Write like a real person talking, not like AI. Hard rules:",
  "- Never use an em dash. Use periods and commas.",
  ...ANTI_AI_RULES.filter((r) => r.id !== "em-dash").map(
    (r) => `- Never: ${r.label.replace(/[“”]/g, '"')}.`,
  ),
  "- No neat groups of three. No tidy moral at the end. No rhetorical question followed by the answer.",
  "- Keep it imperfect: fragments, restarts, casual words, the way people actually talk on camera.",
  "- Short sentences. Plain words. If it sounds like a LinkedIn post, rewrite it.",
].join("\n");
