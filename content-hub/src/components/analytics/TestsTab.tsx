"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, FlaskConical, Plus, Trash2, Trophy } from "lucide-react";
import { PostDialog } from "@/components/plan/PostDialog";
import { Badge, Button, Card, ConfirmAction, Empty, cx, inputCls } from "@/components/ui";
import { METRIC_INFO, compact, testLeader } from "@/lib/insights";
import { clockLabel } from "@/lib/plan";
import { studioUrl } from "@/lib/studio/actions";
import { withDefaults } from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import type { Test } from "@/lib/types";
import { TestDialog, VARIABLES } from "./TestDialog";

export function TestsTab() {
  const tests = useHub((s) => s.tests);
  const [creating, setCreating] = useState(false);
  const sorted = [...tests].sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === "running" ? -1 : 1));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          Trial reels go to non-followers first, so you can post a few versions of one video and keep the winner. Change one thing at a time: the line on
          screen, the spoken hook, the caption, the sound.
        </p>
        <Button variant="primary" onClick={() => setCreating(true)} data-tests-new>
          <Plus className="size-3.5" /> New test
        </Button>
      </div>
      {sorted.length ? (
        <div className="space-y-3" data-tests>
          {sorted.map((t) => (
            <TestCard key={t.id} test={t} />
          ))}
        </div>
      ) : (
        <Empty>
          <FlaskConical className="mx-auto mb-2 size-5 text-ghost" />
          No tests yet. Start one here or from a card&apos;s Posts tab.
        </Empty>
      )}
      {creating && <TestDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function TestCard({ test }: { test: Test }) {
  const posts = useHub((s) => s.posts);
  const items = useHub((s) => s.items);
  const [open, setOpen] = useState<string | null>(null);
  const card = items.find((i) => i.id === test.cardId);
  const leader = testLeader(test, posts);
  const winner = test.variants.find((v) => v.id === test.winner);
  const set = (patch: Partial<Test>) => useHub.getState().updateRecord("tests", test.id, patch);
  const info = METRIC_INFO[test.metric];

  // Put the winning version on the card, so the next post uses it.
  const apply = () => {
    if (!card || !winner) return;
    const hub = useHub.getState();
    if (test.variable === "overlay") {
      hub.updateItem(card.id, { overlay: winner.value });
      // Versions of one Studio edit: the winner goes back on screen there too.
      if (winner.editId && test.variants.every((v) => v.editId === winner.editId))
        hub.updateEdit(winner.editId, (e) => ({ overlay: { ...withDefaults(e).overlay, text: winner.value } }));
    }
    else if (test.variable === "caption") hub.updateItem(card.id, { caption: winner.value });
    else if (test.variable === "hook") {
      const i = card.hooks.indexOf(winner.value);
      hub.updateItem(card.id, i >= 0 ? { chosenHook: i } : { hooks: [...card.hooks, winner.value], chosenHook: card.hooks.length });
    }
  };

  return (
    <Card>
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <FlaskConical className="size-4 text-faint" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{test.name}</span>
        <Badge>{VARIABLES.find((v) => v.id === test.variable)?.label}</Badge>
        <Badge tone={test.status === "done" ? "good" : "neutral"}>{test.status === "done" ? "Done" : "Running"}</Badge>
        <ConfirmAction question="Delete this test?" onConfirm={() => useHub.getState().deleteRecord("tests", test.id)} className="rounded p-1 text-faint hover:text-critical-text" title="Delete test">
          <Trash2 className="size-3.5" />
        </ConfirmAction>
      </header>
      <ul className="divide-y divide-line">
        {test.variants.map((v) => {
          const post = posts.find((p) => p.id === v.postId);
          const value = post?.results?.[test.metric];
          const isWinner = test.winner === v.id;
          const ahead = !test.winner && leader?.variant.id === v.id;
          return (
            <li key={v.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-2.5 text-xs", isWinner && "bg-good/5")}>
              <span className={cx("grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-medium", isWinner ? "bg-good/20 text-good-text" : "bg-surface-3 text-muted")}>
                {v.label}
              </span>
              <span className="min-w-0 flex-1 text-ink">{v.value}</span>
              {v.editId && (
                <Link href={studioUrl(v.editId)} className="inline-flex items-center gap-0.5 text-faint hover:text-ink">
                  Edit <ArrowUpRight className="size-3" />
                </Link>
              )}
              <button onClick={() => post && setOpen(post.id)} className="w-36 text-right text-faint hover:text-ink" disabled={!post}>
                {!post
                  ? "No post"
                  : post.status === "planned"
                    ? `Posts ${new Date(post.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${clockLabel(post.at)}`
                    : value != null
                      ? <span className="font-medium tabular-nums text-ink">{compact(value, info.pct)} {info.short}</span>
                      : "Log results"}
              </button>
              {isWinner ? (
                <span className="inline-flex w-24 items-center justify-end gap-1 text-good-text">
                  <Trophy className="size-3.5" /> Winner
                </span>
              ) : (
                <button onClick={() => set({ winner: v.id, status: "done" })} className={cx("w-24 text-right", ahead ? "font-medium text-ink" : "text-faint hover:text-ink")} data-test-winner>
                  {ahead ? "Ahead · pick" : "Pick winner"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="space-y-2 border-t border-line px-4 py-3">
        {leader && !test.winner && (
          <p className="text-xs text-muted">
            {leader.variant.label} is ahead on {info.label.toLowerCase()}
            {leader.margin < 0.15 ? ", but by less than 15%: close enough to be luck. Consider running it again." : ` by ${Math.round(leader.margin * 100)}%.`}
          </p>
        )}
        {winner && card && test.variable !== "audio" && test.variable !== "thumbnail" && test.variable !== "length" && test.variable !== "other" && (
          <Button size="sm" onClick={apply}>
            <Check className="size-3.5" /> Use {winner.label} on the card
          </Button>
        )}
        <textarea
          value={test.learned}
          onChange={(e) => set({ learned: e.target.value })}
          rows={2}
          placeholder="What it taught you, in a line. Claude reads this when it writes hooks."
          className={cx(inputCls, "resize-y text-xs")}
        />
      </div>
      {open && <PostDialog postId={open} onClose={() => setOpen(null)} focus="results" />}
    </Card>
  );
}
