"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload, RotateCcw, CircleCheck, CircleAlert } from "lucide-react";
import { Button, PageHeader, Panel, cx } from "@/components/ui";
import { useHub } from "@/lib/store";

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
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/claude")
      .then((r) => r.json())
      .then((d) => setClaude(!!d.configured))
      .catch(() => setClaude(false));
  }, []);

  const exportData = () => {
    const s = useHub.getState();
    const data = {
      exportedAt: new Date().toISOString(),
      items: s.items,
      stories: s.stories,
      voiceEntries: s.voiceEntries,
      voiceProfile: s.voiceProfile,
      swipe: s.swipe,
      activityDays: s.activityDays,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `content-hub-backup-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error();
      importData(data);
      setMsg(`Restored ${data.items.length} cards from ${file.name}.`);
    } catch {
      setMsg("That file isn't a Content Hub backup.");
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings & backup" subtitle="Your data lives in this browser for now. Back it up, move it to another computer, or start fresh." />

      <div className="space-y-6">
        <Panel title="Claude">
          <div className="flex items-start gap-3 p-4 text-sm">
            {claude === null ? (
              <span className="text-faint">Checking…</span>
            ) : claude ? (
              <>
                <CircleCheck className="mt-0.5 size-4 text-good" />
                <span className="text-muted">Connected. The Claude panel, voice profile and idea generator are live.</span>
              </>
            ) : (
              <>
                <CircleAlert className="mt-0.5 size-4 text-warn" />
                <div className="text-muted">
                  Not connected yet. Create an API key at console.anthropic.com, then add{" "}
                  <code className="rounded bg-surface-3 px-1 font-mono text-xs text-ink">ANTHROPIC_API_KEY=…</code> to{" "}
                  <code className="rounded bg-surface-3 px-1 font-mono text-xs text-ink">content-hub/.env.local</code> and restart the
                  app. Everything else works without it.
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Backup">
          <div className="flex flex-wrap items-center gap-2 p-4">
            <Button variant="primary" onClick={exportData}>
              <Download className="size-4" /> Download backup
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Restore from backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <div className="flex-1" />
            <Button
              variant="danger"
              onClick={() => {
                if (confirm("Reset everything back to the starter content? Download a backup first if you want to keep anything.")) {
                  resetAll();
                  setMsg("Reset to starter content.");
                }
              }}
            >
              <RotateCcw className="size-4" /> Reset
            </Button>
            {msg && <p className="w-full pt-2 text-xs text-muted">{msg}</p>}
          </div>
        </Panel>

        <Panel title="Roadmap">
          <ol className="divide-y divide-line">
            {ROADMAP.map((r) => (
              <li key={r.phase} className="flex gap-4 px-4 py-3">
                <span className="w-16 shrink-0 font-mono text-xs text-faint">{r.phase}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    {r.title}
                    {r.status && (
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                          r.status === "Now" ? "bg-accent/15 text-accent" : "border border-line text-faint",
                        )}
                      >
                        {r.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{r.items}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
