"use client";

import { useMemo } from "react";
import { Card, cx } from "@/components/ui";
import { clipperStats, flagsFor, isUS, latest, money, riskOf } from "@/lib/clipping";
import { useHub } from "@/lib/store";
import { useNow } from "@/lib/useNow";

/** The network at a glance: this month's numbers, who's doing it for real, and where the accounts are. */
export function OverviewTab({ onReview }: { onReview: () => void }) {
  const clippers = useHub((s) => s.clippers);
  const submissions = useHub((s) => s.submissions);
  const accounts = useHub((s) => s.accounts);
  const drops = useHub((s) => s.drops);
  const now = useNow();
  const d = new Date(now);
  const since = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

  const month = submissions.filter((s) => s.postedAt >= since);
  const views = month.reduce((n, s) => n + (latest(s).views ?? 0), 0);
  const usViews = month.filter((s) => s.status === "approved" || s.status === "paid").reduce((n, s) => n + (s.usViews ?? 0), 0);
  const owed = submissions.filter((s) => s.status === "approved").reduce((n, s) => n + (s.amount ?? 0), 0);
  const pending = submissions.filter((s) => s.status === "pending");
  const fake = pending.filter((s) => riskOf(flagsFor(s, { submissions, accounts }, now)) === "high").length;
  const network = accounts.filter((a) => a.clipperId || a.kind === "clipping");

  const board = useMemo(
    () =>
      clippers
        .filter((c) => c.status !== "removed")
        .map((c) => ({ c, st: clipperStats(c, { submissions, accounts, drops }, since) }))
        .sort((a, b) => b.st.usViews - a.st.usViews),
    [clippers, submissions, accounts, drops, since],
  );

  // Where the network's accounts are based, as the About this account screens show.
  const places = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of network) {
      const k = a.basedIn?.trim() || "Not shown yet";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [network]);
  const top = Math.max(1, ...places.map(([, n]) => n));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-clipping-tiles>
        <Tile label="Views this month" value={views.toLocaleString()} sub={`${month.length} posts by ${new Set(month.map((s) => s.clipperId)).size} clippers`} />
        <Tile label="Verified US views" value={usViews.toLocaleString()} sub="approved posts only" />
        <Tile label="Owed" value={money(owed)} sub="approved, not paid" />
        <button onClick={onReview} className="text-left">
          <Tile label="To check" value={String(pending.length)} sub={fake ? `${fake} look fake` : "none flagged as fake"} warn={fake > 0} />
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Clippers this month" description="By verified US views: what you actually pay for">
          {board.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs" data-clipping-board>
                <thead>
                  <tr className="border-y border-line text-left text-[11px] text-faint">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Clipper</th>
                    <th className="px-2 py-2 text-right font-medium">Posts</th>
                    <th className="px-2 py-2 text-right font-medium">Views</th>
                    <th className="px-2 py-2 text-right font-medium">US views</th>
                    <th className="px-2 py-2 text-right font-medium">Flagged</th>
                    <th className="px-4 py-2 text-right font-medium">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {board.map(({ c, st }, i) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2 tabular-nums text-faint">{i + 1}</td>
                      <td className="px-2 py-2 text-ink">{c.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{st.posts}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{st.views.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink">{st.usViews.toLocaleString()}</td>
                      <td className={cx("px-2 py-2 text-right tabular-nums", st.flagged ? "text-critical-text" : "text-faint")}>{st.flagged}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink">{money(st.earned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 pb-4 pt-2 text-xs text-faint">No clippers yet.</p>
          )}
        </Card>

        <Card title="Where the accounts are based" description={`${network.length} clipping accounts`}>
          <ul className="space-y-2 px-4 pb-4 pt-2" data-clipping-places>
            {places.length ? (
              places.map(([place, n]) => (
                <li key={place} className="text-xs">
                  <div className="flex justify-between">
                    <span className={isUS(place) ? "text-good-text" : place === "Not shown yet" ? "text-faint" : "text-critical-text"}>{place}</span>
                    <span className="tabular-nums text-ink">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={cx("h-full rounded-full", isUS(place) ? "bg-good" : place === "Not shown yet" ? "bg-muted/40" : "bg-critical")} style={{ width: `${(n / top) * 100}%` }} />
                  </div>
                </li>
              ))
            ) : (
              <li className="text-xs text-faint">Accounts show here as clippers add them.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={cx("rounded-xl border bg-surface px-4 py-3", warn ? "border-critical/40" : "border-line")}>
      <div className="text-[11px] text-faint">{label}</div>
      <div className={cx("mt-1 text-lg font-semibold tracking-tight", warn ? "text-critical-text" : "text-ink")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ghost">{sub}</div>}
    </div>
  );
}
