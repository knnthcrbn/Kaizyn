// Where the hub is running. The full app runs on Next.js with its own server
// route for Claude; the claude.ai-hosted copy is a single page that reaches
// Claude and file saving through the viewer's runtime capabilities instead.

export const IN_CLAUDE = process.env.NEXT_PUBLIC_TARGET === "artifact";

type Runtime = { use?: (name: string) => Promise<unknown> };

/** A claude.ai runtime capability, or null where this view can't use it. */
export async function capability<T>(name: string): Promise<T | null> {
  if (!IN_CLAUDE || typeof window === "undefined") return null;
  const runtime = (window as unknown as { claude?: Runtime }).claude;
  if (!runtime?.use) return null;
  try {
    return ((await runtime.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}

export type Sample = (
  input: { role: "user" | "assistant"; content: string }[],
  options: { onText?: (u: { text: string }) => void; signal?: AbortSignal; cache?: boolean },
) => Promise<{ text: string; truncated: boolean }>;

export type Downloads = {
  save: (req: { filename: string; data: string }) => Promise<{ status: "saved" | "delivered" }>;
};
