"use client";

import { LoginScreen } from "@/components/login/LoginScreen";
import { safeNext } from "@/lib/auth";

export default function LoginPage() {
  return (
    <LoginScreen
      onSignIn={async (password) => {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return body.error ?? `Couldn't sign in (${res.status}).`;
        }
        // A full page load, so the server sees the new session cookie.
        window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")));
        return null;
      }}
    />
  );
}
