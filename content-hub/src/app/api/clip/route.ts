import { connection } from "next/server";
import { clipperFor, portalView } from "@/lib/clipServer";

// A clipper's portal: their clips to post, accounts, posts and earnings.
// Outside the hub's sign-in; the key in their link is the only way in.
export async function GET(req: Request) {
  await connection();
  try {
    const found = await clipperFor(req);
    if (found instanceof Response) return found;
    return Response.json(await portalView(found.doc, found.clipper));
  } catch (err) {
    return Response.json({ error: `Couldn't load your portal: ${(err as Error).message}` }, { status: 500 });
  }
}
