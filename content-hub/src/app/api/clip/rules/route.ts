import { clipperFor } from "@/lib/clipServer";
import { changeHub } from "@/lib/hubServer";

/** The clipper agrees to the rules (once), before posting anything. */
export async function POST(req: Request) {
  const found = await clipperFor(req);
  if (found instanceof Response) return found;
  const id = found.clipper.id;
  await changeHub((doc) => {
    const c = doc.clippers.find((x) => x.id === id);
    if (!c || c.acceptedRulesAt) return null;
    return { ops: { upserts: { clippers: [{ ...c, acceptedRulesAt: Date.now(), updatedAt: Date.now() }] } }, result: true };
  });
  return Response.json({ ok: true });
}
