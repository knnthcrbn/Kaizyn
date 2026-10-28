import { failure, structured } from "@/lib/footage/claude";
import { HOOK_TYPES } from "@/lib/hookTypes";

// Tags each card's hook with its type from the hook library, so Analytics can
// compare results by hook type without anyone tagging by hand. Haiku: it's a
// sorting job, and it can run over every card at once.
export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: HOOK_TYPES.map((h) => h.id) },
        },
        required: ["id", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["tags"],
  additionalProperties: false,
};

const SYSTEM = `You sort short-form video hooks (the opening line) into hook types. Pick the single type that best describes how the hook grabs attention. Types:
${HOOK_TYPES.map((h) => `- ${h.id}: ${h.name}`).join("\n")}`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { hooks?: { id: string; text: string }[] } | null;
  const hooks = body?.hooks?.filter((h) => typeof h.id === "string" && typeof h.text === "string" && h.text.trim()).slice(0, 200);
  if (!hooks?.length) return Response.json({ error: "No hooks to tag." }, { status: 400 });
  try {
    const out = await structured<{ tags: { id: string; type: string }[] }>({
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 8000,
      content: [{ type: "text", text: `Tag each hook by its id:\n${hooks.map((h) => `${h.id}: ${h.text.trim().slice(0, 300)}`).join("\n")}` }],
    });
    const ids = new Set(hooks.map((h) => h.id));
    const valid = new Set(HOOK_TYPES.map((h) => h.id));
    return Response.json({ tags: out.tags.filter((t) => ids.has(t.id) && valid.has(t.type)) });
  } catch (err) {
    const f = failure(err);
    return Response.json({ error: f.message }, { status: f.status });
  }
}
