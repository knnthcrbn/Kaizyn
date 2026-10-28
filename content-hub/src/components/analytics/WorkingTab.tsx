"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Sparkles, Tags } from "lucide-react";
import { Button, Card, Empty, Segmented, cx } from "@/components/ui";
import { DIMENSIONS, ENOUGH, METRIC_INFO, breakdown, compact, factsFor, measured } from "@/lib/insights";
import { IN_CLAUDE } from "@/lib/platform";
import { useHub } from "@/lib/store";
import type { TestMetric } from "@/lib/types";

/** What's working: each way of slicing the posts, best first, with how many posts back it up. */
export function WorkingTab() {
  const posts = useHub((s) => s.posts);
  const items = useHub((s) => s.items);
  const edits = useHub((s) => s.edits);
  const accounts = useHub((s) => s.accounts);
  const askClaude = useHub((s) => s.askClaude);
  const [metric, setMetric] = useState<TestMetric>("views");
  const [tagging, setTagging] = useState(false);
  const [note, setNote] = useState("");

  const facts = useMemo(() => factsFor(measured(posts), items, edits, accounts), [posts, items, edits, accounts]);
  const withMetric = facts.filter((f) => f.post.results?.[metric] != null);
  // Cards with a hook whose type hasn't been tagged: Claude can sort them in one go.
  const untagged = items.filter((i) => !i.hookType && (i.hooks[i.chosenHook] || i.overlay).trim());

  const tag = async () => {
    setTagging(true);
    setNote("");
    try {
      const res = await fetch("/api/analytics/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hooks: untagged.slice(0, 200).map((i) => ({ id: i.id, text: i.hooks[i.chosenHook] || i.overlay })) }),
      });
      const data = (await res.json().catch(() => ({}))) as { tags?: { id: string; type: string }[]; error?: string };
      if (!res.ok || !data.tags) throw new Error(data.error ?? `Tagging failed (${res.status}).`);
      const hub = useHub.getState();
      for (const t of data.tags) hub.updateItem(t.id, { hookType: t.type });
      setNote(`Tagged ${data.tags.length} hook${data.tags.length === 1 ? "" : "s"}. Change any on its card.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setTagging(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={metric} onChange={setMetric} options={(Object.keys(METRIC_INFO) as TestMetric[]).map((m) => ({ value: m, label: METRIC_INFO[m].label }))} />
        <div className="ml-auto flex flex-wrap gap-2">
          {untagged.length > 0 && !IN_CLAUDE && (
            <Button size="sm" onClick={() => void tag()} disabled={tagging} data-working-tag>
              {tagging ? <LoaderCircle className="size-3.5 animate-spin" /> : <Tags className="size-3.5" />}
              Tag {untagged.length} hook type{untagged.length === 1 ? "" : "s"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ai"
            onClick={() =>
              askClaude(
                "Look at my results. What's working for my audience and what isn't? Be specific (hook types, pillars, lengths, times), say how sure you are given how many posts there are, then give me 5 video ideas that follow what's working, each with a hook.",
              )
            }
          >
            <Sparkles className="size-3.5" /> Ask Claude what to make next
          </Button>
        </div>
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}

      {withMetric.length < ENOUGH ? (
        <Empty>
          Log {METRIC_INFO[metric].label.toLowerCase()} for at least {ENOUGH} posts and this fills in: which hook types, pillars, lengths and times do best
          with your audience. {withMetric.length ? `${withMetric.length} so far.` : ""}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-working>
          {DIMENSIONS.map((dim) => {
            const groups = breakdown(withMetric, dim, metric);
            if (groups.length < 2) return null;
            const top = Math.max(...groups.map((g) => g.median), 1);
            const best = [...groups].filter((g) => g.n >= ENOUGH).sort((a, b) => b.median - a.median)[0];
            return (
              <Card key={dim.id} title={dim.label} description={best ? `Best: ${best.key}` : `Not enough posts in any group yet`}>
                <ul className="space-y-1.5 px-4 pb-4 pt-2">
                  {groups.map((g) => (
                    <li key={g.key} className={cx("text-xs", g.n < ENOUGH && "opacity-50")} title={g.n < ENOUGH ? "Too few posts to call it" : undefined}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-muted">{g.key}</span>
                        <span className="shrink-0 tabular-nums text-ink">
                          {compact(g.median, METRIC_INFO[metric].pct)} <span className="text-ghost">· {g.n}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div className={cx("h-full rounded-full", g === best ? "bg-good" : "bg-muted/60")} style={{ width: `${(g.median / top) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-ghost">
        Medians per post, so one viral video doesn&apos;t make its whole group look good. Faded rows have fewer than {ENOUGH} posts. Claude reads this summary
        whenever it writes hooks, scripts and ideas with you.
      </p>
    </div>
  );
}
