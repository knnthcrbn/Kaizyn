"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, LoaderCircle, Send, Sparkles } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FieldLabel, PlatformChips } from "@/components/plan/bits";
import { ScheduleDialog } from "@/components/plan/ScheduleDialog";
import { Badge, Button, Card, Empty, cx, inputCls, selectCls } from "@/components/ui";
import { dropSpent, latest, money } from "@/lib/clipping";
import { useLibrary } from "@/lib/footage/library";
import { timecode } from "@/lib/footage/search";
import { platformLabel } from "@/lib/meta";
import { IN_CLAUDE } from "@/lib/platform";
import { useHub } from "@/lib/store";
import type { Drop, Platform } from "@/lib/types";

const DEFAULT_BRIEF = `Post it as it is, or with one of the hooks on screen in the first second.
Use your own caption if you like; keep it on topic and keep the hashtags short.
Don't cut what's said, add music over the voice, or post the same clip twice on one account.`;

const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

export function DropsTab() {
  const drops = useHub((s) => s.drops);
  const submissions = useHub((s) => s.submissions);
  const clippers = useHub((s) => s.clippers);
  const footage = useLibrary((s) => s.items);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [scheduling, setScheduling] = useState<Drop | null>(null);
  const active = clippers.filter((c) => c.status === "active").length;
  const sorted = [...drops].sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === "live" ? -1 : 1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          A drop is a clip for every clipper to post. Sending one puts it in all {active} active clipper{active === 1 ? "'s" : "s'"} portals at once, with
          the hooks and captions shuffled per clipper so a hundred pages don&apos;t post the same words.
        </p>
        <Button variant="primary" onClick={() => setEditing("new")} data-drops-new>
          <Send className="size-3.5" /> New drop
        </Button>
      </div>
      {sorted.length ? (
        <div className="grid gap-3 lg:grid-cols-2" data-drops>
          {sorted.map((d) => {
            const subs = submissions.filter((s) => s.dropId === d.id);
            const views = subs.reduce((n, s) => n + (latest(s).views ?? 0), 0);
            const us = subs.reduce((n, s) => n + (s.usViews ?? 0), 0);
            const spent = dropSpent(d.id, submissions);
            const f = d.footageId ? footage[d.footageId] : undefined;
            return (
              <Card key={d.id}>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setEditing(d.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-ink hover:underline">
                      {d.title}
                    </button>
                    <Badge tone={d.status === "live" ? "good" : "neutral"}>{d.status === "live" ? "Live" : "Ended"}</Badge>
                  </div>
                  <p className="text-[11px] text-faint">
                    {f ? `${f.name} · ${timecode(f.duration ?? 0)}` : "No video attached"} · {d.platforms.map(platformLabel).join(", ")}
                    {d.cpm != null ? ` · ${money(d.cpm)}/1k US` : ""}
                  </p>
                  <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                    <Num label="Posts" value={subs.length.toLocaleString()} />
                    <Num label="Clippers" value={new Set(subs.map((s) => s.clipperId)).size.toLocaleString()} />
                    <Num label="Views" value={views.toLocaleString()} />
                    <Num label="US views paid" value={us.toLocaleString()} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-faint">
                    <span>
                      Spent {money(spent)}
                      {d.budget != null ? ` of ${money(d.budget)}` : ""}
                    </span>
                    <span className="ml-auto flex gap-3">
                      {d.cardId && (
                        <button onClick={() => setScheduling(d)} className="inline-flex items-center gap-1 hover:text-ink">
                          <CalendarPlus className="size-3.5" /> Our own pages
                        </button>
                      )}
                      <button
                        onClick={() => useHub.getState().updateRecord("drops", d.id, { status: d.status === "live" ? "ended" : "live" })}
                        className="hover:text-ink"
                      >
                        {d.status === "live" ? "End it" : "Send again"}
                      </button>
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty>No drops yet. Export a clip in Studio and save it to Footage, then drop it to every clipper at once.</Empty>
      )}
      {editing && <DropDialog id={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {scheduling?.cardId && <ScheduleDialog cardId={scheduling.cardId} onClose={() => setScheduling(null)} />}
    </div>
  );
}

function Num({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-faint">{label}</div>
      <div className="tabular-nums text-ink">{value}</div>
    </div>
  );
}

function DropDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const existing = useHub((s) => (id ? s.drops.find((d) => d.id === id) : undefined));
  const items = useHub((s) => s.items);
  const voice = useHub((s) => s.voiceProfile);
  const footageMap = useLibrary((s) => s.items);
  const videos = useMemo(
    () =>
      Object.values(footageMap)
        .filter((f) => f.uploaded)
        // Exports first: finished clips are what clippers should post.
        .sort((a, b) => (a.folder === "Exports" ? 0 : 1) - (b.folder === "Exports" ? 0 : 1) || b.createdAt - a.createdAt),
    [footageMap],
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [footageId, setFootageId] = useState(existing?.footageId ?? videos[0]?.id ?? "");
  const [cardId, setCardId] = useState(existing?.cardId ?? "");
  const [hooks, setHooks] = useState((existing?.hooks ?? []).join("\n"));
  const [captions, setCaptions] = useState((existing?.captions ?? []).join("\n\n"));
  const [brief, setBrief] = useState(existing?.brief ?? DEFAULT_BRIEF);
  const [platforms, setPlatforms] = useState<Platform[]>(existing?.platforms ?? ["instagram", "tiktok"]);
  const [cpm, setCpm] = useState<string>(existing?.cpm != null ? String(existing.cpm) : "");
  const [cap, setCap] = useState<string>(existing?.capPerPost != null ? String(existing.capPerPost) : "");
  const [budget, setBudget] = useState<string>(existing?.budget != null ? String(existing.budget) : "");
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const card = items.find((i) => i.id === cardId);
  const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Number(v)));

  const write = async () => {
    setWriting(true);
    setError("");
    try {
      const res = await fetch("/api/plan/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || card?.title,
          hook: lines(hooks)[0] ?? card?.hooks[card.chosenHook],
          caption: card?.caption,
          script: card?.script,
          voice,
          platforms: platforms.map((platform) => ({ platform, count: 5 })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { variants?: { caption: string }[]; error?: string };
      if (!res.ok || !data.variants) throw new Error(data.error ?? `Writing captions failed (${res.status}).`);
      setCaptions(data.variants.map((v) => v.caption.trim()).join("\n\n"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWriting(false);
    }
  };

  const save = () => {
    const record = {
      title: title.trim() || card?.title || "Untitled clip",
      footageId: footageId || undefined,
      cardId: cardId || undefined,
      hooks: lines(hooks),
      captions: captions.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean),
      brief: brief.trim(),
      platforms,
      cpm: num(cpm),
      capPerPost: num(cap),
      budget: num(budget),
    };
    const hub = useHub.getState();
    if (existing) hub.updateRecord("drops", existing.id, record);
    else hub.addRecord("drops", { ...record, status: "live" });
    onClose();
  };

  return (
    <Modal title={existing ? "Drop" : "New drop"} onClose={onClose} className="max-w-2xl">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" data-drop-dialog>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Video</FieldLabel>
            <select value={footageId} onChange={(e) => setFootageId(e.target.value)} className={cx(selectCls, "w-full")} data-drop-video>
              <option value="">No video (they clip it themselves)</option>
              {videos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.folder ? `${f.folder} › ` : ""}
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Card (optional)</FieldLabel>
            <select
              value={cardId}
              onChange={(e) => {
                setCardId(e.target.value);
                const c = items.find((i) => i.id === e.target.value);
                if (c && !title) setTitle(c.title);
                if (c && !hooks.trim()) setHooks([c.overlay, ...c.hooks].filter((x) => x.trim()).join("\n"));
              }}
              className={cx(selectCls, "w-full")}
            >
              <option value="">None</option>
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <FieldLabel>Title clippers see</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={cx(inputCls, "h-8 py-0")} placeholder="Lost $40k on one ad" data-drop-title />
        </label>
        <div>
          <FieldLabel>Post on</FieldLabel>
          <PlatformChips value={platforms} onChange={setPlatforms} multi />
        </div>
        <label className="block">
          <FieldLabel>Hooks, one per line</FieldLabel>
          <textarea value={hooks} onChange={(e) => setHooks(e.target.value)} rows={3} className={cx(inputCls, "resize-y")} placeholder="The line on screen in the first second" data-drop-hooks />
        </label>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel className="mb-0">Captions, a blank line between each</FieldLabel>
            {!IN_CLAUDE && (
              <Button size="sm" variant="ai" onClick={() => void write()} disabled={writing || !platforms.length}>
                {writing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Write captions
              </Button>
            )}
          </div>
          <textarea value={captions} onChange={(e) => setCaptions(e.target.value)} rows={5} className={cx(inputCls, "resize-y")} />
          {error && <p className="mt-1 text-[11px] text-critical-text">{error}</p>}
        </div>
        <label className="block">
          <FieldLabel>Brief</FieldLabel>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} className={cx(inputCls, "resize-y")} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <FieldLabel>$ per 1k US views</FieldLabel>
            <input value={cpm} onChange={(e) => setCpm(e.target.value)} placeholder="Their own rate" className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>Most per post</FieldLabel>
            <input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="No cap" className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>Budget</FieldLabel>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="No limit" className={cx(inputCls, "h-8 py-0")} />
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={!platforms.length} data-drop-send>
          <Send className="size-3.5" /> {existing ? "Save" : "Send to every clipper"}
        </Button>
      </div>
    </Modal>
  );
}
