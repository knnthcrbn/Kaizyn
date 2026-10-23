import { failure, structured } from "@/lib/footage/claude";
import type { FootageShot } from "@/lib/footage/types";

// Frames sampled from one video go to Claude, which groups them into shots and
// says what's in each, in words an editor would search for.
export const maxDuration = 120;

const SYSTEM = `You catalog raw video footage for a content creator's editing team, so they can search it later ("dog", "tesla", "beach", "gym", "fort lauderdale").

You get frames sampled from ONE video, in order, each labelled with its index and timestamp. Group consecutive frames that show the same shot (same scene and camera setup) into one shot, and describe each shot concretely:
- people by role and count (never guess who someone is), what they're doing, framing (selfie, talking to camera, wide shot)
- objects, animals, food, vehicles with make and model when you can tell (e.g. "white Tesla Model 3")
- the setting (office, gym, car interior, beach, street, restaurant), indoor or outdoor, time of day, weather
- landmarks, city or venue only when clearly identifiable from what's visible
- brands and logos, and any readable on-screen text

tags: 5 to 15 lowercase search terms, singular nouns or short phrases ("dog", "golden retriever", "tesla model 3", "beach", "sunset", "talking to camera").`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shots"],
  properties: {
    shots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["first", "last", "description", "tags", "on_screen_text"],
        properties: {
          first: { type: "integer", description: "Index of the shot's first frame" },
          last: { type: "integer", description: "Index of the shot's last frame" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          on_screen_text: { type: "string" },
        },
      },
    },
  },
};

interface Body {
  frames: { t: number; data: string }[];
  /** Seconds between frames, so the last shot knows where it ends. */
  every: number;
  name?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const frames = body?.frames?.filter((f) => typeof f.t === "number" && typeof f.data === "string") ?? [];
  if (!frames.length || frames.length > 24) return Response.json({ error: "Send 1 to 24 frames." }, { status: 400 });

  const content: import("@anthropic-ai/sdk").default.ContentBlockParam[] = [];
  if (body?.name) content.push({ type: "text", text: `Video file: ${body.name.slice(0, 200)}` });
  frames.forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i} at ${f.t.toFixed(1)}s` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } });
  });
  content.push({ type: "text", text: `Group frames 0 to ${frames.length - 1} into shots and describe each.` });

  try {
    const out = await structured<{ shots: { first: number; last: number; description: string; tags: string[]; on_screen_text: string }[] }>({
      system: SYSTEM,
      content,
      schema: SCHEMA,
    });
    const every = Math.max(0.5, Number(body?.every) || 2);
    const shots: FootageShot[] = out.shots
      .filter((s) => s.first >= 0 && s.first < frames.length)
      .map((s) => {
        const last = Math.min(Math.max(s.last, s.first), frames.length - 1);
        return {
          start: frames[s.first].t,
          end: frames[last].t + every,
          description: s.description.trim(),
          tags: [...new Set(s.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 20),
          ...(s.on_screen_text.trim() ? { onScreenText: s.on_screen_text.trim() } : {}),
        };
      })
      .sort((a, b) => a.start - b.start);
    return Response.json({ shots });
  } catch (err) {
    const { message, status } = failure(err);
    return Response.json({ error: message }, { status });
  }
}
