"use client";

import { useState } from "react";
import { ArrowDown, ClipboardList, FlaskConical } from "lucide-react";
import { Modal } from "@/components/Modal";
import { NumberField, PlatformDot } from "@/components/plan/bits";
import { PostDialog } from "@/components/plan/PostDialog";
import { Badge, Button, Delta, Empty, Segmented, cx } from "@/components/ui";
import { compact, median } from "@/lib/insights";
import { logResults, needsResults, platformLabel, postTitle } from "@/lib/plan";
import { useHub } from "@/lib/store";
import type { Post, PostResults } from "@/lib/types";
import { useNow } from "@/lib/useNow";

const DAY = 86_400_000;
type Range = "7" | "30" | "90" | "all";
type Col = "at" | "views" | "avgWatch" | "shares" | "saves" | "follows";

const COLS: { id: Col; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "avgWatch", label: "% watched" },
  { id: "shares", label: "Shares" },
  { id: "saves", label: "Saves" },
  { id: "follows", label: "Follows" },
];

const sum = (posts: Post[], k: keyof PostResults) => posts.reduce((n, p) => n + ((p.results?.[k] as number | undefined) ?? 0), 0);

export function ResultsTab() {
  const posts = useHub((s) => s.posts);
  const items = useHub((s) => s.items);
  const accounts = useHub((s) => s.accounts);
  const now = useNow();
  const [range, setRange] = useState<Range>("30");
  const [sort, setSort] = useState<Col>("at");
  const [open, setOpen] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const days = range === "all" ? Infinity : Number(range);
  const posted = posts.filter((p) => p.status === "posted");
  const inRange = posted.filter((p) => now - p.at <= days * DAY);
  const before = range === "all" ? [] : posted.filter((p) => now - p.at > days * DAY && now - p.at <= 2 * days * DAY);
  const waiting = posted.filter((p) => needsResults(p, now)).sort((a, b) => b.at - a.at);
  const measuredNow = inRange.filter((p) => p.results?.views != null);

  const rows = [...inRange].sort((a, b) =>
    sort === "at" ? b.at - a.at : ((b.results?.[sort] as number | undefined) ?? -1) - ((a.results?.[sort] as number | undefined) ?? -1),
  );

  const tiles = [
    { label: "Posts", now: inRange.length, before: before.length },
    { label: "Views", now: sum(inRange, "views"), before: sum(before, "views"), big: true },
    { label: "Shares", now: sum(inRange, "shares"), before: sum(before, "shares") },
    { label: "Saves", now: sum(inRange, "saves"), before: sum(before, "saves") },
    { label: "Follows", now: sum(inRange, "follows"), before: sum(before, "follows") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "all", label: "All" },
          ]}
        />
        {measuredNow.length > 0 && (
          <span className="text-xs text-faint">
            Median {compact(median(measuredNow.map((p) => p.results!.views!)))} views a post
            {measuredNow.some((p) => p.results?.avgWatch != null) &&
              `, ${Math.round(median(measuredNow.filter((p) => p.results?.avgWatch != null).map((p) => p.results!.avgWatch!)))}% watched`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" data-results-tiles>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-[11px] text-faint">{t.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight text-ink">{compact(t.now)}</span>
              {range !== "all" && (t.now || t.before) ? <Delta value={Math.round(t.now - t.before)} /> : null}
            </div>
            {range !== "all" && <div className="mt-0.5 text-[11px] text-ghost">vs the {range} days before</div>}
          </div>
        ))}
      </div>

      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3" data-results-waiting>
          <ClipboardList className="size-4 text-muted" />
          <span className="flex-1 text-xs text-muted">
            {waiting.length} post{waiting.length === 1 ? " is" : "s are"} waiting for results. Numbers from about 48 hours after posting compare best.
          </span>
          <Button size="sm" variant="primary" onClick={() => setLogging(true)} data-results-log>
            Log results
          </Button>
        </div>
      )}

      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-xs" data-results-table>
            <thead>
              <tr className="border-b border-line bg-surface text-left text-[11px] text-faint">
                <Th on={sort === "at"} onClick={() => setSort("at")} className="w-28">
                  Posted
                </Th>
                <th className="px-3 py-2 font-medium">Video</th>
                <th className="px-3 py-2 font-medium">Where</th>
                {COLS.map((c) => (
                  <Th key={c.id} on={sort === c.id} onClick={() => setSort(c.id)} className="text-right">
                    {c.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => {
                const acc = accounts.find((a) => a.id === p.accountId);
                return (
                  <tr key={p.id} onClick={() => setOpen(p.id)} className="cursor-pointer bg-bg transition-colors hover:bg-surface-2">
                    <td className="px-3 py-2 tabular-nums text-faint">{new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                    <td className="max-w-64 px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-ink">{postTitle(p, items)}</span>
                        {p.trial && <Badge>Trial</Badge>}
                        {p.testId && <FlaskConical className="size-3 shrink-0 text-faint" />}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5 text-muted">
                        <PlatformDot platform={p.platform} />
                        <span className="truncate">{acc ? `@${acc.handle}` : platformLabel(p.platform)}</span>
                      </span>
                    </td>
                    {COLS.map((c) => {
                      const v = p.results?.[c.id] as number | undefined;
                      return (
                        <td key={c.id} className={cx("px-3 py-2 text-right tabular-nums", v == null ? "text-ghost" : "text-ink")}>
                          {v == null ? "–" : compact(v, c.id === "avgWatch")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Nothing posted in this range. Posts you mark posted (from Today or the Calendar) show here, ready for their numbers.</Empty>
      )}

      {open && <PostDialog postId={open} onClose={() => setOpen(null)} focus="results" />}
      {logging && <LogResults posts={waiting} onClose={() => setLogging(false)} />}
    </div>
  );
}

function Th({ children, on, onClick, className }: { children: React.ReactNode; on: boolean; onClick: () => void; className?: string }) {
  return (
    <th className={cx("px-3 py-2 font-medium", className)}>
      <button onClick={onClick} className={cx("inline-flex items-center gap-0.5 hover:text-ink", on && "text-ink")}>
        {children}
        {on && <ArrowDown className="size-3" />}
      </button>
    </th>
  );
}

type Draft = Omit<PostResults, "at">;

/** Every post waiting for numbers on one sheet, typed in one go from the app's insights. */
function LogResults({ posts, onClose }: { posts: Post[]; onClose: () => void }) {
  const items = useHub((s) => s.items);
  const accounts = useHub((s) => s.accounts);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const filled = Object.entries(drafts).filter(([, d]) => Object.values(d).some((v) => v != null));
  const set = (id: string, k: keyof Draft, v?: number) => setDrafts((all) => ({ ...all, [id]: { ...all[id], [k]: v } }));
  return (
    <Modal title="Log results" onClose={onClose} className="max-w-3xl">
      <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto" data-log-sheet>
        {posts.map((p) => {
          const acc = accounts.find((a) => a.id === p.accountId);
          const d = drafts[p.id] ?? {};
          return (
            <div key={p.id} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-2 text-xs">
                <PlatformDot platform={p.platform} />
                <span className="min-w-0 flex-1 truncate text-ink">{postTitle(p, items)}</span>
                <span className="text-faint">
                  {acc ? `@${acc.handle} · ` : ""}
                  {new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <NumberField label="Views" value={d.views} onChange={(v) => set(p.id, "views", v)} />
                <NumberField label="% watched" suffix="%" max={100} value={d.avgWatch} onChange={(v) => set(p.id, "avgWatch", v)} />
                <NumberField label="Shares" value={d.shares} onChange={(v) => set(p.id, "shares", v)} />
                <NumberField label="Saves" value={d.saves} onChange={(v) => set(p.id, "saves", v)} />
                <NumberField label="Follows" value={d.follows} onChange={(v) => set(p.id, "follows", v)} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
        <span className="text-[11px] text-ghost">Leave a post blank to log it later.</span>
        <Button
          variant="primary"
          disabled={!filled.length}
          onClick={() => {
            for (const [id, d] of filled) logResults(id, d);
            onClose();
          }}
          data-log-save
        >
          Save {filled.length || ""} result{filled.length === 1 ? "" : "s"}
        </Button>
      </div>
    </Modal>
  );
}
