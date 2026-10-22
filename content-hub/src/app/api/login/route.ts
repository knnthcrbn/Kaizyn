import { cookies } from "next/headers";
import { authEnabled, safeEqual, SESSION_COOKIE, SESSION_DAYS, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ ok: true });
  let password = "";
  try {
    password = String((await req.json()).password ?? "");
  } catch {}
  if (!safeEqual(password, process.env.HUB_PASSWORD ?? "")) {
    // A short pause makes guessing slow without bothering a real person.
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "That password isn't right. Try again." }, { status: 401 });
  }
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
  return Response.json({ ok: true });
}
