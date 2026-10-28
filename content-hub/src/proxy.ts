import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, isValidSession, SESSION_COOKIE } from "@/lib/auth";

// Everything sits behind the sign-in once HUB_PASSWORD is set, including the
// Claude route, so nobody else can spend the API key.
export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  // The clipper portal has its own door: the key in each clipper's link,
  // checked by every /api/clip route. The page itself holds no data.
  if (pathname === "/clip" || pathname === "/api/clip" || pathname.startsWith("/api/clip/")) return NextResponse.next();

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
  // The app manifest and icons stay public: browsers fetch the manifest
  // without cookies, and a home-screen icon is no secret.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|apple-icon.png).*)"],
};
