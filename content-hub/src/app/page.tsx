"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ActivityGrid, PillarMix, StageBars, StatTile } from "@/components/charts";
import { DueDate } from "@/components/DueDate";
import { Button, Card, PillarTag, StageTag } from "@/components/ui";
import { STAGES, stageIndex } from "@/lib/meta";
import { METRICS, dailyActivity, streaks, weeklySeries } from "@/lib/metrics";
import { dayKey, useHub } from "@/lib/store";
import type { ContentItem, Pillar } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** What to work on next: overdue first, then due soonest, then closest to done. */
function upNext(items: ContentItem[]) {
  return items
    // In-progress work, plus ideas that already have a date on them.
    .filter((i) => !["posted", "analysed"].includes(i.stage) && (i.stage !== "idea" || i.dueDate))
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return stageIndex(b.stage) - stageIndex(a.stage);
    })
    .slice(0, 6);
}

export default function TodayPage() {
  const items = useHub((s) => s.items);
  const voice = useHub((s) => s.voiceEntries);
  const stories = useHub((s) => s.stories);
  const activityDays = useHub((s) => s.activityDays);
  const askClaude = useHub((s) => s.askClaude);
  const openItem = useHub((s) => s.openItem);

  const queue = upNext(items);
  const { current, longest } = streaks(activityDays);
  const activity = dailyActivity(items, voice, stories, activityDays);
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return dayKey(d);
  }).filter((k) => activity.has(k)).length;

  const working = STAGES.filter((s) => s.id !== "posted" && s.id !== "analysed");
  const rows = working.map((s) => ({ id: s.id, label: s.label, n: items.filter((i) => i.stage === s.id).length }));
  // Bottleneck: the most crowded in-progress stage (ideas piling up is normal).
  const inProgress = rows.filter((r) => r.id !== "idea" && r.n > 1).sort((a, b) => b.n - a.n)[0];

  const mix = { business: 0, lifestyle: 0, personal: 0 } as Record<Pillar, number>;
  items.forEach((i) => mix[i.pillar]++);

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-faint">{date}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{greeting()}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ai" onClick={() => askClaude("I'm blank. Give me 10 video ideas across all three pillars with a hook each.")}>
            <Sparkles className="size-3.5" /> Give me ideas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {METRICS.map((m) => (
          <StatTile key={m.id} label={m.label} hint={m.hint} series={weeklySeries(items, m.id)} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Up next"
          description="Overdue first, then what's closest to done"
          action={
            <Link href="/pipeline" className="flex items-center gap-1 text-xs text-faint hover:text-ink">
              Pipeline <ArrowRight className="size-3" />
            </Link>
          }
        >
          {queue.length ? (
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {queue.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => openItem(i.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 sm:grid-cols-[9rem_1fr_6rem_5.5rem]"
                  >
                    <StageTag stage={i.stage} className="order-2 sm:order-none" />
                    <span className="order-1 truncate text-[13px] text-ink sm:order-none">{i.title}</span>
                    <PillarTag pillar={i.pillar} className="hidden sm:inline-flex" />
                    <span className="hidden text-right sm:block">
                      {i.dueDate ? <DueDate date={i.dueDate} /> : <span className="text-xs text-ghost">No date</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 pb-6 pt-4 text-center">
              <p className="text-[13px] text-muted">Nothing in progress yet.</p>
              <p className="mt-1 text-xs text-faint">
                Open an idea in the{" "}
                <Link href="/pipeline" className="text-ink underline decoration-line-strong underline-offset-2">
                  pipeline
                </Link>{" "}
                and move it to Scripting. It shows up here.
              </p>
            </div>
          )}
        </Card>

        <Card title="Consistency" description="Every capture, script, take and move counts">
          <div className="px-4 pb-4 pt-3">
            <div className="mb-4 grid grid-cols-3 gap-2">
              <Stat label="Current streak" value={`${current}d`} />
              <Stat label="Longest" value={`${longest}d`} />
              <Stat label="Active, 30d" value={`${last30}`} />
            </div>
            <ActivityGrid counts={activity} />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Pipeline" description="Cards in each stage">
          <div className="px-4 pb-4 pt-3">
            <StageBars rows={rows} bottleneck={inProgress?.id} />
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-faint">
              <span>
                {items.filter((i) => i.stage === "posted" || i.stage === "analysed").length} posted all time
              </span>
              <Link href="/pipeline" className="flex items-center gap-1 hover:text-ink">
                Open board <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </Card>

        <Card title="Content mix" description="All cards by pillar">
          <div className="px-4 pb-4 pt-3">
            <PillarMix counts={mix} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tracking-tight text-ink">{value}</div>
      <div className="text-[11px] text-faint">{label}</div>
    </div>
  );
}
