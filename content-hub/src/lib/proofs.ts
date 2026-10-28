// Reading a clipper's proof screenshots with Claude: a post's insights (views,
// likes, where viewers are) and an account's "About this account" screen
// (where it's based, when it joined). Sonnet, because these numbers decide
// what someone is paid. It copies what's shown and says what doesn't add up;
// it never estimates a number that isn't on screen.
import type Anthropic from "@anthropic-ai/sdk";
import { structured } from "./footage/claude";
import { isUS } from "./clipping";
import type { ViewSnapshot } from "./types";

export interface Image {
  /** Base64, no data: prefix. */
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

const MODEL = "claude-sonnet-5-5";
const blocks = (images: Image[]): Anthropic.ContentBlockParam[] =>
  images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mediaType, data: i.data } }));

const POST_SCHEMA = {
  type: "object",
  properties: {
    handle: { type: "string", description: "The account handle shown, without @, or empty." },
    views: { type: "integer", description: "Views or plays; -1 if not shown." },
    likes: { type: "integer" },
    comments: { type: "integer" },
    shares: { type: "integer" },
    saves: { type: "integer" },
    reach: { type: "integer", description: "Accounts reached; -1 if not shown." },
    topCountries: {
      type: "array",
      items: {
        type: "object",
        properties: { country: { type: "string" }, percent: { type: "number" } },
        required: ["country", "percent"],
        additionalProperties: false,
      },
    },
    concerns: { type: "array", items: { type: "string" } },
  },
  required: ["handle", "views", "likes", "comments", "shares", "saves", "reach", "topCountries", "concerns"],
  additionalProperties: false,
};

const POST_SYSTEM = `You read screenshots of one social media post's insights (Instagram, TikTok, YouTube, Facebook) and copy the numbers exactly as shown. The numbers decide what a clipper is paid, so never estimate.

- Write numbers in full: 12.4K is 12400, 1.2M is 1200000. Use -1 for anything not shown.
- topCountries: the countries list from the audience or viewer locations section ("Top countries", "Locations", "Viewers by location"), with their percentages. Empty if no countries are shown. Use full English country names ("United States").
- concerns: short plain sentences about anything that doesn't add up, only when you can see it: the screenshots show different posts or different accounts; numbers that contradict each other (more likes than views, percentages over 100); text that looks pasted in or misaligned; the countries are for the whole account rather than this post. Empty if nothing.`;

export async function readPostProof(images: Image[], expect: { handle?: string; platform: string }) {
  const out = await structured<{
    handle: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    reach: number;
    topCountries: { country: string; percent: number }[];
    concerns: string[];
  }>({
    model: MODEL,
    system: POST_SYSTEM,
    schema: POST_SCHEMA,
    maxTokens: 3000,
    content: [
      ...blocks(images),
      { type: "text", text: `A ${expect.platform} post${expect.handle ? ` the clipper says is from @${expect.handle}` : ""}. Read the screenshots.` },
    ],
  });
  const n = (v: number) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);
  const countries = out.topCountries.filter((c) => c.country.trim() && Number.isFinite(c.percent)).map((c) => ({ country: c.country.trim(), pct: c.percent }));
  const us = countries.find((c) => isUS(c.country));
  const snap: Omit<ViewSnapshot, "at" | "source" | "proofs"> = {
    handle: out.handle.replace(/^@/, "").trim() || undefined,
    views: n(out.views),
    likes: n(out.likes),
    comments: n(out.comments),
    shares: n(out.shares),
    saves: n(out.saves),
    reach: n(out.reach),
    topCountries: countries.length ? countries : undefined,
    // A country list without the US in it means a small US share, not an unknown one.
    usShare: us ? Math.min(1, us.pct / 100) : countries.length ? 0 : undefined,
    concerns: out.concerns.filter((c) => c.trim()),
  };
  return snap;
}

const ACCOUNT_SCHEMA = {
  type: "object",
  properties: {
    handle: { type: "string" },
    basedIn: { type: "string", description: "The 'Account based in' country, or empty." },
    joined: { type: "string", description: "'Date joined' as shown, like 'March 2026', or empty." },
    followers: { type: "integer", description: "-1 if not shown." },
    concerns: { type: "array", items: { type: "string" } },
  },
  required: ["handle", "basedIn", "joined", "followers", "concerns"],
  additionalProperties: false,
};

export async function readAccountProof(images: Image[], expect: { handle: string; platform: string }) {
  const out = await structured<{ handle: string; basedIn: string; joined: string; followers: number; concerns: string[] }>({
    model: MODEL,
    system:
      "You read screenshots of a social media account's profile and its 'About this account' screen (Instagram shows 'Date joined' and 'Account based in'). Copy exactly what's shown; empty or -1 for anything not shown. concerns: short sentences about anything that doesn't add up (different accounts across screenshots, text that looks edited). Empty if nothing.",
    schema: ACCOUNT_SCHEMA,
    maxTokens: 1000,
    content: [...blocks(images), { type: "text", text: `A ${expect.platform} account the clipper says is @${expect.handle}. Read the screenshots.` }],
  });
  return {
    handle: out.handle.replace(/^@/, "").trim() || undefined,
    basedIn: out.basedIn.trim() || undefined,
    joined: out.joined.trim() || undefined,
    followers: out.followers >= 0 ? out.followers : undefined,
    concerns: out.concerns.filter((c) => c.trim()),
  };
}
