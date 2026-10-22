"use client";

import { TriangleAlert } from "lucide-react";
import { dayKey } from "@/lib/store";
import { PILLAR_STYLE, PILLARS } from "@/lib/meta";
import type { Pillar } from "@/lib/types";
import { cx, Delta } from "./ui";

/* ------------------------------------------------------------------ */
/* Stat tile: this week's number, change vs last week, 8-week trend.   */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  hint,
  series,
}: {
  label: string;
  hint: string;
  series: { start: number; count: number }[];
}) {
  const current = series[series.length - 1]?.count ?? 0;
  const previous = series[series.length - 2]?.count ?? 0;
  const max = Math.max(1, ...series.map((s) => s.count));
  const w = 6;
  const gap = 3;
  const h = 28;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="hidden text-[11px] text-ghost sm:inline">This week</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-ink">{current}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5">
            <Delta value={current - previous} />
            <span className="text-[11px] text-ghost">vs last week</span>
          </div>
        </div>
        <svg
          className="hidden shrink-0 sm:block"
          width={series.length * (w + gap) - gap}
          height={h}
          role="img"
          aria-label={`${label}, last ${series.length} weeks: ${series.map((s) => s.count).join(", ")}`}
        >
          {series.map((s, i) => {
            const bh = s.count ? Math.max(3, (s.count / max) * h) : 1;
            const last = i === series.length - 1;
            const wk = new Date(s.start).toLocaleDateString(undefined, { month: "short", day: "numeric" });
            return (
              <g key={s.start}>
                {/* Taller invisible hit area so the tooltip is easy to reach. */}
                <rect x={i * (w + gap)} y={0} width={w + gap} height={h} fill="transparent">
                  <title>{`Week of ${wk}: ${s.count}`}</title>
                </rect>
                <rect
                  x={i * (w + gap)}
                  y={h - bh}
                  width={w}
                  height={bh}
                  rx={1.5}
                  className={last ? "fill-ink" : "fill-surface-3"}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 hidden border-t border-line pt-2 text-[11px] text-ghost sm:block">{hint}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity grid: one cell per day, single-hue green ramp by activity. */
/* ------------------------------------------------------------------ */

const HEAT = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"];

export function ActivityGrid({ counts, weeks = 17 }: { counts: Map<string, number>; weeks?: number }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today);
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);

  const cols = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(date);
      const n = counts.get(key) ?? 0;
      return { key, n, future: date > today, date };
    }),
  );

  return (
    <div>
      <div className="flex gap-[3px]">
        <div className="mr-1 flex flex-col justify-between py-px text-[9px] leading-none text-ghost">
          <span>Mon</span>
          <span>Thu</span>
          <span>Sun</span>
        </div>
        {cols.map((col, i) => (
          <div key={i} className="flex flex-1 flex-col gap-[3px]">
            {col.map((c) => (
              <div
                key={c.key}
                title={
                  c.future
                    ? undefined
                    : `${c.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${c.n} action${c.n === 1 ? "" : "s"}`
                }
                className={cx("aspect-square w-full rounded-[3px]", c.future ? "bg-transparent" : HEAT[level(c.n)])}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-ghost">
        Less
        {HEAT.map((h) => (
          <span key={h} className={cx("size-2.5 rounded-[2px]", h)} />
        ))}
        More
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage bars: neutral, with the bottleneck called out in amber.       */
/* ------------------------------------------------------------------ */

export function StageBars({
  rows,
  bottleneck,
}: {
  rows: { id: string; label: string; n: number }[];
  bottleneck?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const hot = r.id === bottleneck;
        return (
          <div key={r.id} className="group flex items-center gap-3 text-xs" title={`${r.label}: ${r.n}`}>
            <span className={cx("w-28 shrink-0 truncate", hot ? "text-ink" : "text-muted")}>{r.label}</span>
            <div className="relative h-5 flex-1">
              <div
                className={cx(
                  "absolute inset-y-0 left-0 rounded-r-[4px] transition-all",
                  hot ? "bg-warning" : "bg-surface-3 group-hover:bg-line-strong",
                  r.n === 0 && "opacity-0",
                )}
                style={{ width: `${(r.n / max) * 100}%`, minWidth: r.n ? 4 : 0 }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-ink">{r.n}</span>
            <span className="w-24 shrink-0">
              {hot && (
                <span className="inline-flex items-center gap-1 text-[11px] text-warning">
                  <TriangleAlert className="size-3" /> Bottleneck
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pillar mix: stacked bar with 2px gaps, plus a legend with numbers.  */
/* ------------------------------------------------------------------ */

export function PillarMix({ counts }: { counts: Record<Pillar, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {total === 0 ? (
          <div className="flex-1 bg-surface-3" />
        ) : (
          PILLARS.filter((p) => counts[p.id] > 0).map((p) => (
            <div
              key={p.id}
              className={PILLAR_STYLE[p.id].dot}
              style={{ flexGrow: counts[p.id] }}
              title={`${p.label}: ${counts[p.id]}`}
            />
          ))
        )}
      </div>
      <ul className="mt-4 space-y-3">
        {PILLARS.map((p) => (
          <li key={p.id} className="flex items-start gap-2.5">
            <span className={cx("mt-1 size-2 shrink-0 rounded-[3px]", PILLAR_STYLE[p.id].dot)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-ink">{p.label}</span>
                <span className="tabular-nums text-muted">
                  {counts[p.id]}
                  <span className="ml-1.5 text-ghost">{total ? Math.round((counts[p.id] / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-faint">{p.blurb}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
