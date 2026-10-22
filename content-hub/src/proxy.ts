import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, isValidSession, SESSION_COOKIE } from "@/lib/auth";

// Everything sits behind the sign-in once HUB_PASSWORD is set, including the
// Claude route, so nobody else can spend the API key.
export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
