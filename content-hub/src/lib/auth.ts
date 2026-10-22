// One-password sign-in for the hub, the same pattern as the Leads Management
// App. Set HUB_PASSWORD on the server to turn it on; with no password set
// (local `npm run dev`) the hub stays open.
//
// The session cookie holds an HMAC of a fixed label, never the password.
// AUTH_SECRET keys it when set; otherwise the password does, so changing the
// password signs every device out. Works in Proxy and route handlers alike
// (Web Crypto only).

export const SESSION_COOKIE = "hub_session";
export const SESSION_DAYS = 30;

export const authEnabled = () => !!process.env.HUB_PASSWORD;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken() {
  const secret = process.env.AUTH_SECRET || process.env.HUB_PASSWORD || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("content-hub-v1")));
}

/** Equality that doesn't stop at the first differing character. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookie: string | undefined) {
  return !!cookie && safeEqual(cookie, await sessionToken());
}

/** Only follow ?next= when it's a path on this site, never an outside link. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
