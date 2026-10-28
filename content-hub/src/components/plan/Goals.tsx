"use client";

import { Plus, Target, Trash2 } from "lucide-react";
import { Button, Card, Empty, cx, selectCls } from "@/components/ui";
import { PILLARS, pillarLabel } from "@/lib/meta";
import { goalLabel, goalProgress, PLATFORMS } from "@/lib/plan";
import { useHub } from "@/lib/store";
import type { Goal } from "@/lib/types";
import { PlatformDot } from "./bits";

/** This week against each goal: posted (solid) and scheduled (outline). */
export function GoalsStrip({ week, compact }: { week: number; compact?: boolean }) {
  const goals = useHub((s) => s.goals);
  const posts = useHub((s) => s.posts);
  const items = useHub((s) => s.items);
  if (!goals.length) return null;
  return (
    <div className={cx("grid gap-2", compact ? "" : "sm:grid-cols-2 xl:grid-cols-4")} data-goals-strip>
      {goals.map((g) => {
        const p = goalProgress(g, posts, items, week);
        const hit = p.done >= g.perWeek;
        return (
          <div key={g.id} className="rounded-lg border border-line bg-surface px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted">
                {g.platform !== "any" && <PlatformDot platform={g.platform} />}
                {goalLabel(g, pillarLabel)}
              </span>
              <span className={cx("shrink-0 tabular-nums", hit ? "font-medium text-good-text" : "text-ink")}>
                {p.done}/{g.perWeek}
              </span>
            </div>
            <div className="mt-1.5 flex h-1.5 gap-0.5">
              {Array.from({ length: Math.max(g.perWeek, p.done) }, (_, i) => (
                <span
                  key={i}
                  className={cx(
                    "flex-1 rounded-full",
                    i < p.done ? "bg-good" : i < p.done + p.planned ? "border border-line-strong bg-surface-3" : "bg-surface-3/50",
                  )}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Setting the weekly targets. */
export function GoalsPanel({ week }: { week: number }) {
  const goals = useHub((s) => s.goals);
  const set = (g: Goal, patch: Partial<Goal>) => useHub.getState().updateRecord("goals", g.id, patch);
  const add = (platform: Goal["platform"], pillar: Goal["pillar"], perWeek: number) => useHub.getState().addRecord("goals", { platform, pillar, perWeek });
  return (
    <div className="space-y-5">
      <Card title="Posting goals" description="Videos a week, per platform and pillar. A video counts once per platform, however many accounts it goes to.">
        <div className="space-y-2 p-4" data-goals>
          {goals.length ? (
            goals.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={g.perWeek}
                  onChange={(e) => set(g, { perWeek: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                  className={cx(selectCls, "w-16 tabular-nums")}
                  aria-label="Videos a week"
                />
                <span className="text-xs text-faint">a week of</span>
                <select value={g.pillar} onChange={(e) => set(g, { pillar: e.target.value as Goal["pillar"] })} className={selectCls} aria-label="Pillar">
                  <option value="any">any pillar</option>
                  {PILLARS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-faint">on</span>
                <select value={g.platform} onChange={(e) => set(g, { platform: e.target.value as Goal["platform"] })} className={selectCls} aria-label="Platform">
                  <option value="any">any platform</option>
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button onClick={() => useHub.getState().deleteRecord("goals", g.id)} className="rounded p-1 text-faint hover:text-critical-text" aria-label="Remove goal">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          ) : (
            <Empty>
              <Target className="mx-auto mb-2 size-5 text-ghost" />
              No goals yet. Start small and keep it: a target you hit every week beats a big one you miss.
            </Empty>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => add("any", "any", 3)} data-goal-add>
              <Plus className="size-3.5" /> Add a goal
            </Button>
            {!goals.length && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  add("instagram", "business", 3);
                  add("instagram", "personal", 2);
                  add("instagram", "lifestyle", 2);
                  add("youtube", "any", 1);
                }}
              >
                Start with a mix (7 shorts and a YouTube video a week)
              </Button>
            )}
          </div>
        </div>
      </Card>
      {goals.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">This week</div>
          <GoalsStrip week={week} />
        </div>
      )}
    </div>
  );
}
