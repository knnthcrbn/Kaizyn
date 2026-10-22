// The Claude models and effort levels the hub offers, shared by the chat UI and
// the server route. Prices are Anthropic's first-party API rates per million
// tokens (Oct 2026); they only feed the "≈ cost" shown under each reply.

export type ModelId = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5" | "claude-fable-5-1";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelInfo {
  id: ModelId;
  label: string;
  blurb: string;
  /** $ per million tokens: input, output, 5-minute cache write, cache read. */
  price: { in: number; out: number; write: number; read: number };
  /** The newer web tools (results filtered before they reach the context). */
  dynamicWeb: boolean;
  /** Server-side fallback when a safety classifier declines the request. */
  fallbacks: boolean;
}

export const MODELS: ModelInfo[] = [
  {
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    blurb: "Best for most work",
    price: { in: 4, out: 20, write: 5, read: 0.2 },
    dynamicWeb: true,
    fallbacks: true,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    blurb: "Fast and capable, half the price",
    price: { in: 2, out: 10, write: 2.5, read: 0.2 },
    dynamicWeb: true,
    fallbacks: true,
  },
  {
    id: "claude-haiku-5-5",
    label: "Haiku 5.5",
    blurb: "Fastest and cheapest, for quick tasks",
    // Cache rates for Haiku 5.5 aren't published in our reference; the usual
    // 1.25x write / 0.1x read ratios are close enough for an estimate.
    price: { in: 0.1, out: 0.5, write: 0.125, read: 0.01 },
    dynamicWeb: false,
    fallbacks: false,
  },
  {
    id: "claude-fable-5-1",
    label: "Fable 5.1",
    blurb: "Most capable. Slower, 2.5x Opus price",
    price: { in: 10, out: 50, write: 12.5, read: 0.25 },
    dynamicWeb: true,
    fallbacks: true,
  },
];

export const DEFAULT_MODEL: ModelId = "claude-opus-5-5";
export const DEFAULT_EFFORT: Effort = "medium";

export const EFFORTS: { id: Effort; label: string; short: string; blurb: string }[] = [
  { id: "low", label: "Low", short: "Low", blurb: "Quick answers" },
  { id: "medium", label: "Medium", short: "Med", blurb: "Balanced (default)" },
  { id: "high", label: "High", short: "High", blurb: "Harder problems" },
  { id: "xhigh", label: "Extra high", short: "XHigh", blurb: "Deep work, takes longer" },
  { id: "max", label: "Max", short: "Max", blurb: "Everything it has. Slowest, priciest" },
];

export const modelInfo = (id: string | undefined) => MODELS.find((m) => m.id === id) ?? MODELS[0];
export const isModel = (id: unknown): id is ModelId => MODELS.some((m) => m.id === id);
export const isEffort = (e: unknown): e is Effort => EFFORTS.some((x) => x.id === e);
export const effortLabel = (e: string | undefined) => EFFORTS.find((x) => x.id === e)?.label ?? "Medium";

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  searches: number;
}

/** Web search is billed per search on top of tokens. */
const PER_SEARCH = 0.01;

export function estimateCost(model: string | undefined, u: Usage) {
  const p = modelInfo(model).price;
  return (u.input * p.in + u.output * p.out + u.cacheWrite * p.write + u.cacheRead * p.read) / 1e6 + u.searches * PER_SEARCH;
}

export function formatCost(usd: number) {
  if (usd < 0.01) return "<1¢";
  if (usd < 1) return `${Math.round(usd * 100)}¢`;
  return `$${usd.toFixed(2)}`;
}
