"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Upload, RotateCcw, CircleCheck, CircleAlert, LogOut, ArrowRight } from "lucide-react";
import { Badge, Button, Card, ConfirmAction, PageHeader } from "@/components/ui";
import { capability, IN_CLAUDE, type Downloads, type Sample } from "@/lib/platform";
import { useHub } from "@/lib/store";
import { clearChats, exportChats, importChats, monthSpend, useChats } from "@/lib/chats";
import { formatCost } from "@/lib/models";

const ROADMAP = [
  { phase: "Phase 1", title: "Shell + writing system", status: "Now", items: "Pipeline, Today, Claude panel, Voice Lab, hooks, story bank, swipe file, playbooks, teleprompter" },
  { phase: "Phase 2", title: "Studio", status: "Next", items: "Editing, auto-captions, overlays, exports, repurposing long form into shorts, B-roll library" },
  { phase: "Phase 3", title: "Calendar & habit", status: "", items: "Calendar, posting goals per pillar, batch recording days, weekly review" },
  { phase: "Phase 4", title: "Analytics & testing", status: "", items: "Results per post, trial reel A/B log, trending audio tracker, feedback into Claude" },
  { phase: "Phase 5", title: "Accounts & publishing", status: "Last", items: "Connect main + clipping pages, multi-account scheduling, staggered posts" },
];

export default function SettingsPage() {
  const importData = useHub((s) => s.importData);
  const resetAll = useHub((s) => s.resetAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const [claude, setClaude] = useState<boolean | null>(null);
  const [host, setHost] = useState<"vercel" | "local">("vercel");
  // Re-read when chats change so the month's spend stays current.
  useChats((st) => st.chats);
  const spend = monthSpend();
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (IN_CLAUDE) {
      capability<Sample>("sample").then((s) => setClaude(!!s));
      return;
    }
    fetch("/api/claude")
      .then((r) => r.json())
      .then((d) => {
        setClaude(!!d.configured);
        if (d.host === "local") setHost("local");
      })
      .catch(() => setClaude(false));
  }, []);

  const exportData = async () => {
    const s = useHub.getState();
    const data = {
      exportedAt: new Date().toISOString(),
      items: s.items,
      stories: s.stories,
      voiceEntries: s.voiceEntries,
      voiceProfile: s.voiceProfile,
      swipe: s.swipe,
      activityDays: s.activityDays,
      chats: exportChats(),
    };
    const json = JSON.stringify(data, null, 2);
    const filename = `content-hub-backup-${data.exportedAt.slice(0, 10)}.json`;
    if (IN_CLAUDE) {
      // The hosted page can't start downloads itself; claude.ai asks the viewer.
      const downloads = await capability<Downloads>("downloads");
      if (!downloads) return setMsg("Saving files isn't available in this view.");
      try {
        await downloads.save({ filename, data: json });
        setMsg(`Saved ${filename}.`);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== "declined") setMsg("Couldn't save the backup here. Try again in a moment.");
      }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error();
      importData(data);
      importChats(data.chats);
      setMsg(`Restored ${data.items.length} cards from ${file.name}.`);
    } catch {
      setMsg("That file isn't a Content Hub backup.");
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings & backup" description="Your data lives in this browser for now. Back it up, move it to another computer, or start fresh." />

      <div className="space-y-6">
        <Card title="Claude">
          <div className="flex items-start gap-3 px-4 pb-4 pt-3 text-[13px]">
            {claude === null ? (
              <span className="text-faint">Checking…</span>
            ) : claude ? (
              <>
                <CircleCheck className="mt-0.5 size-4 text-good-text" />
                <div className="text-muted">
                  {IN_CLAUDE ? (
                    "Connected through your claude.ai account. The first time Claude runs, it asks your permission."
                  ) : (
                    <>
                      Connected. Pick the model and effort under the message box in any chat.
                      <div className="mt-2 text-xs text-faint">
                        This month: ≈{formatCost(spend.total)} across {spend.replies} repl{spend.replies === 1 ? "y" : "ies"}{" "}
                        (estimated from token counts; your Anthropic Console has the exact bill).
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : IN_CLAUDE ? (
              <>
                <CircleAlert className="mt-0.5 size-4 text-warning" />
                <span className="text-muted">Claude isn&apos;t available in this view. Open the hub inside claude.ai to use it.</span>
              </>
            ) : (
              <>
                <CircleAlert className="mt-0.5 size-4 text-warning" />
                <div className="text-muted">
                  Not connected yet. Create an API key at console.anthropic.com (Billing, then API Keys), then add it as{" "}
                  <code className="rounded bg-surface-3 px-1 font-mono text-xs text-ink">ANTHROPIC_API_KEY</code>{" "}
                  {host === "vercel" ? (
                    <>in Vercel under content-hub → Settings → Environment Variables, and redeploy.</>
                  ) : (
                    <>
                      in <code className="rounded bg-surface-3 px-1 font-mono text-xs text-ink">content-hub/.env.local</code> and restart
                      the app.
                    </>
                  )}{" "}
                  API use is billed per reply, separately from a Claude subscription. Everything else works without it.
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title="Sign-in" description={IN_CLAUDE ? "This copy is private to your claude.ai account, so it needs no sign-in." : "One password, set as HUB_PASSWORD on the server. With none set, the hub stays open."}>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3">
            <Link
              href="/login"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 text-[13px] font-medium text-ink hover:bg-surface-3"
            >
              See the sign-in screen <ArrowRight className="size-3.5" />
            </Link>
            {!IN_CLAUDE && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await fetch("/api/logout", { method: "POST" });
                  // A full load drops every page the router cached while signed in.
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.assign("/login");
                }}
              >
                <LogOut className="size-3.5" /> Sign out
              </Button>
            )}
          </div>
        </Card>

        <Card title="Backup">
          <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3">
            <Button variant="primary" onClick={exportData}>
              <Download className="size-3.5" /> Download backup
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" /> Restore from backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <div className="flex-1" />
            <ConfirmAction
              question="Erase everything and go back to the starter content?"
              confirmLabel="Reset"
              onConfirm={() => {
                resetAll();
                clearChats();
                setMsg("Reset to starter content.");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-critical-text hover:bg-critical/10"
            >
              <RotateCcw className="size-3.5" /> Reset
            </ConfirmAction>
            {msg && <p className="w-full pt-2 text-xs text-muted">{msg}</p>}
          </div>
        </Card>

        <Card title="Roadmap">
          <ol className="mt-2 divide-y divide-line border-t border-line">
            {ROADMAP.map((r) => (
              <li key={r.phase} className="flex gap-4 px-4 py-3">
                <span className="w-16 shrink-0 font-mono text-xs text-faint">{r.phase}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[13px] text-ink">
                    {r.title}
                    {r.status && <Badge tone={r.status === "Now" ? "good" : "neutral"}>{r.status}</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{r.items}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
