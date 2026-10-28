"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronDown, ChevronRight, LoaderCircle, Minus, Sparkles } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button, cx, inputCls, selectCls } from "@/components/ui";
import { stageIndex } from "@/lib/meta";
import { atTime, clockLabel, planPosts, PLATFORMS, platformLabel, staggerTimes } from "@/lib/plan";
import { IN_CLAUDE } from "@/lib/platform";
import { dayKey, useHub } from "@/lib/store";
import type { Account, Platform } from "@/lib/types";
import { FieldLabel, PlatformChips, PlatformDot } from "./bits";

interface Target {
  key: string;
  platform: Platform;
  account?: Account;
}

const groupName = (a: Account) => a.group.trim() || (a.kind === "main" ? "Main accounts" : "Clipping pages");

function defaultTime(day: string) {
  if (day !== dayKey()) return "09:00";
  const d = new Date(Date.now() + 60 * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/** Plans one video onto many accounts: staggered times, a caption per account. */
export function ScheduleDialog({ cardId: given, day: givenDay, onClose }: { cardId?: string; day?: string; onClose: () => void }) {
  const items = useHub((s) => s.items);
  const accounts = useHub((s) => s.accounts);
  const sounds = useHub((s) => s.sounds);
  const voice = useHub((s) => s.voiceProfile);
  const active = useMemo(() => accounts.filter((a) => a.active), [accounts]);
  const cards = useMemo(
    () => items.filter((i) => stageIndex(i.stage) < stageIndex("posted")).sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage)),
    [items],
  );
  const [cardId, setCardId] = useState(given ?? cards[0]?.id ?? "");
  const card = items.find((i) => i.id === cardId);
  const [day, setDay] = useState(givenDay ?? dayKey());
  const [time, setTime] = useState(defaultTime(givenDay ?? dayKey()));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(active.filter((a) => a.kind === "main").map((a) => a.id)));
  const [bare, setBare] = useState<Platform[]>(active.length ? [] : ["instagram"]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [gap, setGap] = useState(15);
  const [jitter, setJitter] = useState(5);
  const [trial, setTrial] = useState(false);
  const [soundId, setSoundId] = useState("");
  const [caption, setCaption] = useState(card?.caption ?? "");
  const [variants, setVariants] = useState<Record<string, string[]>>({});
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");

  // Accounts by platform, then group: "Instagram › IG clips A (100)".
  const tree = useMemo(() => {
    const out: { platform: Platform; groups: { name: string; list: Account[] }[] }[] = [];
    for (const p of PLATFORMS) {
      const on = active.filter((a) => a.platform === p.id);
      if (!on.length) continue;
      const groups = new Map<string, Account[]>();
      for (const a of on) groups.set(groupName(a), [...(groups.get(groupName(a)) ?? []), a]);
      out.push({ platform: p.id, groups: [...groups].map(([name, list]) => ({ name, list })) });
    }
    return out;
  }, [active]);

  const targets: Target[] = [
    ...active.filter((a) => picked.has(a.id)).map((a) => ({ key: a.id, platform: a.platform, account: a })),
    ...bare.map((p) => ({ key: `bare:${p}`, platform: p })),
  ];
  const start = atTime(day, time);
  const times = staggerTimes(start, targets.length, gap, targets.length > 1 ? jitter : 0, Math.round(start / 60_000));
  const hasInstagram = targets.some((t) => t.platform === "instagram");

  // Each target's caption: its platform's variants in turn, else the one caption.
  const captions = (() => {
    const seen: Partial<Record<Platform, number>> = {};
    return targets.map((t) => {
      const list = variants[t.platform];
      const k = (seen[t.platform] = (seen[t.platform] ?? -1) + 1);
      return list?.length ? list[k % list.length] : caption;
    });
  })();
  const variantCount = Object.values(variants).reduce((n, l) => n + l.length, 0);

  const toggle = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const write = async () => {
    setWriting(true);
    setError("");
    try {
      const counts = new Map<Platform, number>();
      for (const t of targets) counts.set(t.platform, (counts.get(t.platform) ?? 0) + 1);
      const res = await fetch("/api/plan/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: card?.title,
          hook: card ? card.hooks[card.chosenHook] : undefined,
          caption,
          script: card?.script,
          voice,
          platforms: [...counts].map(([platform, n]) => ({ platform, count: Math.min(25, n) })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { variants?: { platform: Platform; caption: string }[]; error?: string };
      if (!res.ok || !data.variants) throw new Error(data.error ?? `Writing captions failed (${res.status}).`);
      const by: Record<string, string[]> = {};
      for (const v of data.variants) (by[v.platform] ??= []).push(v.caption.trim());
      setVariants(by);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWriting(false);
    }
  };

  const submit = () => {
    planPosts({
      cardId: card?.id,
      targets: targets.map((t) => ({ platform: t.platform, accountId: t.account?.id })),
      start,
      gapMin: gap,
      jitterMin: targets.length > 1 ? jitter : 0,
      captions,
      trial: hasInstagram && trial,
      soundId: soundId || undefined,
    });
    onClose();
  };

  return (
    <Modal title="Schedule" onClose={onClose} className="max-w-2xl">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4" data-schedule>
        {!given && (
          <label className="block">
            <FieldLabel>Video</FieldLabel>
            <select
              value={cardId}
              onChange={(e) => {
                setCardId(e.target.value);
                setCaption(items.find((i) => i.id === e.target.value)?.caption ?? "");
                setVariants({});
              }}
              className={cx(selectCls, "w-full")}
            >
              <option value="">A post with no card</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>Day</FieldLabel>
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className={cx(selectCls, "w-full")} />
          </label>
          <label className="block">
            <FieldLabel>{targets.length > 1 ? "First post at" : "Time"}</FieldLabel>
            <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={cx(selectCls, "w-full")} />
          </label>
        </div>

        <section>
          <FieldLabel>Accounts</FieldLabel>
          {tree.length ? (
            <div className="divide-y divide-line rounded-lg border border-line">
              {tree.flatMap((p) =>
                p.groups.map((g) => {
                  const key = `${p.platform}:${g.name}`;
                  const ids = g.list.map((a) => a.id);
                  const n = ids.filter((id) => picked.has(id)).length;
                  const expanded = open.has(key);
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={n === ids.length ? true : n ? "mixed" : false}
                          aria-label={`${platformLabel(p.platform)} ${g.name}`}
                          onClick={() => toggle(ids, n < ids.length)}
                          className={cx("grid size-4 shrink-0 place-items-center rounded border", n ? "border-ink bg-ink text-bg" : "border-line-strong")}
                        >
                          {n === ids.length ? <span className="text-[10px] leading-none">✓</span> : n ? <Minus className="size-3" /> : null}
                        </button>
                        <PlatformDot platform={p.platform} />
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">
                          {platformLabel(p.platform)} · {g.name}
                        </span>
                        <span className="text-[11px] tabular-nums text-faint">
                          {n}/{ids.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpen((s) => (s.has(key) ? new Set([...s].filter((x) => x !== key)) : new Set(s).add(key)))}
                          className="rounded p-0.5 text-faint hover:text-ink"
                          aria-label={expanded ? "Hide accounts" : "Show accounts"}
                        >
                          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                      </div>
                      {expanded && (
                        <div className="grid max-h-48 gap-x-3 overflow-y-auto px-9 pb-2 sm:grid-cols-2">
                          {g.list.map((a) => (
                            <label key={a.id} className="flex items-center gap-2 py-0.5 text-xs text-muted">
                              <input type="checkbox" checked={picked.has(a.id)} onChange={(e) => toggle([a.id], e.target.checked)} className="accent-white" />@{a.handle}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          ) : (
            <>
              <PlatformChips value={bare} onChange={setBare} multi />
              <p className="mt-1.5 text-[11px] leading-relaxed text-ghost">
                Add your main accounts and clipping pages on the{" "}
                <Link href="/accounts" className="text-muted underline underline-offset-2">
                  Accounts
                </Link>{" "}
                page to schedule to each of them by name.
              </p>
            </>
          )}
        </section>

        {targets.length > 1 && (
          <section className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Minutes between posts</FieldLabel>
              <input type="number" min={0} max={720} value={gap} onChange={(e) => setGap(Math.max(0, Number(e.target.value) || 0))} className={cx(selectCls, "w-full")} />
            </label>
            <label className="block">
              <FieldLabel>Random ± minutes</FieldLabel>
              <input type="number" min={0} max={120} value={jitter} onChange={(e) => setJitter(Math.max(0, Number(e.target.value) || 0))} className={cx(selectCls, "w-full")} />
            </label>
            <p className="col-span-2 text-[11px] leading-relaxed text-ghost">
              {targets.length} posts from {clockLabel(times[0])} to {clockLabel(Math.max(...times))}
              {new Date(Math.max(...times)).toDateString() !== new Date(times[0]).toDateString() ? " the next day" : ""}. Spacing them out, with a
              little randomness, keeps clipping pages from posting the same video in the same minute.
            </p>
          </section>
        )}

        <section>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <FieldLabel className="mb-0">Caption</FieldLabel>
            {targets.length > 1 && !IN_CLAUDE && (
              <Button size="sm" variant="ai" onClick={() => void write()} disabled={writing} data-schedule-variants>
                {writing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {variantCount ? "Write them again" : "A caption per account"}
              </Button>
            )}
          </div>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} className={cx(inputCls, "resize-y")} placeholder="The caption, with hashtags" />
          {error && <p className="mt-1.5 text-[11px] text-critical-text">{error}</p>}
          {variantCount > 0 && (
            <details className="mt-2 rounded-lg border border-line px-3 py-2">
              <summary className="cursor-pointer text-xs text-muted">
                {variantCount} captions written
                {variantCount < targets.length ? `, taking turns across ${targets.length} accounts` : ", one per account"}
              </summary>
              <div className="mt-2 space-y-2">
                {Object.entries(variants).map(([platform, list]) =>
                  list.map((v, i) => (
                    <div key={`${platform}:${i}`} className="flex gap-2">
                      <PlatformDot platform={platform as Platform} className="mt-2.5" />
                      <textarea
                        value={v}
                        onChange={(e) => setVariants((all) => ({ ...all, [platform]: all[platform].map((x, j) => (j === i ? e.target.value : x)) }))}
                        rows={2}
                        className={cx(inputCls, "resize-y py-1.5 text-xs")}
                      />
                    </div>
                  )),
                )}
              </div>
            </details>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Sound to add in the app</FieldLabel>
            <select value={soundId} onChange={(e) => setSoundId(e.target.value)} className={cx(selectCls, "w-full")}>
              <option value="">The video&apos;s own audio</option>
              {sounds
                .filter((x) => x.status !== "faded")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                    {x.artist ? ` · ${x.artist}` : ""}
                  </option>
                ))}
            </select>
          </label>
          {hasInstagram && (
            <label className="flex items-center gap-2 self-end pb-1.5 text-xs text-muted">
              <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} className="accent-white" />
              Instagram posts go out as trial reels
            </label>
          )}
        </section>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="text-[11px] text-ghost">Until a posting service is connected, each one shows on Today with its caption to copy.</span>
        <Button variant="primary" onClick={submit} disabled={!targets.length} data-schedule-submit>
          <CalendarPlus className="size-3.5" /> {targets.length > 1 ? `Schedule ${targets.length} posts` : "Schedule"}
        </Button>
      </div>
    </Modal>
  );
}
