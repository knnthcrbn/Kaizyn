"use client";

import Link from "next/link";
import { ArrowRight, Clapperboard, Eye, Send, Sparkles } from "lucide-react";
import { Constellation } from "@/components/Constellation";
import { ItemCard } from "@/components/ItemCard";
import { QuickCapture } from "@/components/QuickCapture";
import { Button, Panel, cx } from "@/components/ui";
import { PILLARS, PILLAR_STYLE, STAGES } from "@/lib/meta";
import { streakFrom, useHub } from "@/lib/store";
import type { ContentItem, StageId } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const byStage = (items: ContentItem[], ...stages: StageId[]) =>
  items.filter((i) => stages.includes(i.stage));

export default function TodayPage() {
  const items = useHub((s) => s.items);
  const activityDays = useHub((s) => s.activityDays);
  const askClaude = useHub((s) => s.askClaude);
  const streak = streakFrom(activityDays);

  const record = byStage(items, "ready").concat(byStage(items, "scripting")).slice(0, 4);
  const review = byStage(items, "editing", "review").slice(0, 4);
  const posting = byStage(items, "scheduled").slice(0, 4);

  // Where things are piling up (ignores ideas and finished work).
  const working = STAGES.filter((s) => !["idea", "posted", "analysed"].includes(s.id));
  const counts = STAGES.map((s) => ({ ...s, n: items.filter((i) => i.stage === s.id).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const bottleneck = counts
    .filter((c) => working.some((w) => w.id === c.id))
    .sort((a, b) => b.n - a.n)[0];

  const posted = items.filter((i) => i.stage === "posted" || i.stage === "analysed");
  const mix = PILLARS.map((p) => ({ ...p, n: items.filter((i) => i.pillar === p.id).length }));
  const mixTotal = Math.max(1, mix.reduce((a, b) => a + b.n, 0));

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <section className="glow relative overflow-hidden rounded-3xl border border-line px-6 py-8 sm:px-8 sm:py-10">
        <Constellation className="absolute inset-0 h-full w-full opacity-70" />
        <div className="relative max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-faint">{date}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="text-gradient">{greeting()}.</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {streak > 0
              ? `${streak}-day streak. Keep it alive: one thing today counts.`
              : "One thing today counts. Capture an idea, write a hook, record one take."}
          </p>
          <div className="mt-6">
            <QuickCapture />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <TodayColumn
          title="Record next"
          icon={Clapperboard}
          items={record}
          empty="Nothing scripted yet. Pick an idea and write the hook."
          href="/pipeline"
        />
        <TodayColumn
          title="Needs your eyes"
          icon={Eye}
          items={review}
          empty="Nothing in editing or review."
          href="/pipeline"
        />
        <TodayColumn
          title="Going out"
          icon={Send}
          items={posting}
          empty="Nothing scheduled. Publishing hooks up in a later phase; for now, track it here."
          href="/pipeline"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Pipeline"
          action={
            bottleneck && bottleneck.n > 0 ? (
              <span className="text-xs text-warn">Piling up in: {bottleneck.label}</span>
            ) : null
          }
        >
          <div className="space-y-1.5 p-4">
            {counts.map((c) => (
              <Link key={c.id} href="/pipeline" className="group flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 text-muted group-hover:text-ink">{c.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-all"
                    style={{ width: `${(c.n / max) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right tabular-nums text-ink">{c.n}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Your mix" action={<span className="text-xs text-faint">{posted.length} posted</span>}>
          <div className="space-y-4 p-4">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
              {mix.map((m) => (
                <div key={m.id} className={PILLAR_STYLE[m.id].dot} style={{ width: `${(m.n / mixTotal) * 100}%` }} />
              ))}
            </div>
            <ul className="space-y-2.5">
              {mix.map((m) => (
                <li key={m.id} className="flex items-start gap-2.5 text-xs">
                  <span className={cx("mt-1 size-2 rounded-full", PILLAR_STYLE[m.id].dot)} />
                  <div className="flex-1">
                    <div className="text-ink">
                      {m.label} <span className="text-faint">· {m.n}</span>
                    </div>
                    <div className="text-faint">{m.blurb}</div>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => askClaude("I'm blank. Give me 10 video ideas across all three pillars with a hook each.")}
            >
              <Sparkles className="size-4" /> I&apos;m blank. Give me ideas.
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TodayColumn({
  title,
  icon: Icon,
  items,
  empty,
  href,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ContentItem[];
  empty: string;
  href: string;
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-accent" /> {title}
        </span>
      }
      action={
        <Link href={href} className="flex items-center gap-1 text-xs text-faint hover:text-ink">
          All <ArrowRight className="size-3" />
        </Link>
      }
    >
      <div className="space-y-2 p-3">
        {items.length ? (
          items.map((i) => <ItemCard key={i.id} item={i} compact />)
        ) : (
          <p className="px-1 py-4 text-center text-xs text-faint">{empty}</p>
        )}
      </div>
    </Panel>
  );
}
