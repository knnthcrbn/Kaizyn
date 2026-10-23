// Entry point for the claude.ai-hosted copy: the same screens and shell as the
// Next.js app, rendered as one page.
import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useRoute } from "./router";
import Today from "@/app/page";
import Chat from "@/app/chat/page";
import Pipeline from "@/app/pipeline/page";
import Ideas from "@/app/ideas/page";
import Voice from "@/app/voice/page";
import Hooks from "@/app/hooks/page";
import Stories from "@/app/stories/page";
import Swipe from "@/app/swipe/page";
import Playbooks from "@/app/playbooks/page";
import Studio from "@/app/studio/page";
import Library from "@/app/library/page";
import Calendar from "@/app/calendar/page";
import Analytics from "@/app/analytics/page";
import Accounts from "@/app/accounts/page";
import Settings from "@/app/settings/page";
import { LoginScreen } from "@/components/login/LoginScreen";

const SCREENS: Record<string, ComponentType> = {
  "/": Today,
  "/chat": Chat,
  "/pipeline": Pipeline,
  "/ideas": Ideas,
  "/voice": Voice,
  "/hooks": Hooks,
  "/stories": Stories,
  "/swipe": Swipe,
  "/playbooks": Playbooks,
  "/library": Library,
  "/studio": Studio,
  "/calendar": Calendar,
  "/analytics": Analytics,
  "/accounts": Accounts,
  "/settings": Settings,
  "/login": LoginPreview,
};

/** On claude.ai the page is already private to you, so this is a preview. */
function LoginPreview() {
  const go = useRoute((s) => s.go);
  return (
    <LoginScreen
      note="Preview: any password opens the hub here."
      onSignIn={async () => {
        await new Promise((r) => setTimeout(r, 500));
        go("/");
        return null;
      }}
    />
  );
}

function Screen() {
  const path = useRoute((s) => s.path);
  const Page = SCREENS[path] ?? Today;
  return <Page />;
}

createRoot(document.getElementById("hub")!).render(
  <AppShell>
    <Screen />
  </AppShell>,
);
