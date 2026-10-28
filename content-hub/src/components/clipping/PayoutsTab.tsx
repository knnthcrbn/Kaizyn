"use client";

import { Download, Wallet } from "lucide-react";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { HOLD_DAYS, money, payableFrom, payoutsCsv } from "@/lib/clipping";
import { useHub } from "@/lib/store";
import type { Submission } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { CopyButton } from "./ClippersTab";

/** A payout for these approved posts: they leave "owed" and wait to be marked paid. */
function pay(clipperId: string, subs: Submission[]) {
  const hub = useHub.getState();
  const id = hub.addRecord("payouts", {
    clipperId,
    submissionIds: subs.map((s) => s.id),
    usViews: subs.reduce((n, s) => n + (s.usViews ?? 0), 0),
    amount: Math.round(subs.reduce((n, s) => n + (s.amount ?? 0), 0) * 100) / 100,
    status: "owed",
    note: "",
  });
  for (const s of subs) hub.updateRecord("submissions", s.id, { payoutId: id });
}

/** The money went out: the payout and its posts are settled. */
function markPaid(payoutId: string) {
  const hub = useHub.getState();
  const p = hub.payouts.find((x) => x.id === payoutId);
  if (!p) return;
  hub.updateRecord("payouts", payoutId, { status: "paid", paidAt: Date.now() });
  for (const id of p.submissionIds) hub.updateRecord("submissions", id, { status: "paid" });
}

/** What each clipper is owed, paying only posts past the hold, and a record of what went out. */
export function PayoutsTab() {
  const clippers = useHub((s) => s.clippers);
  const submissions = useHub((s) => s.submissions);
  const payouts = useHub((s) => s.payouts);
  const now = useNow();

  // Approved, not in a payout yet: payable now, or still in the hold.
  const owed = clippers
    .map((c) => {
      const mine = submissions.filter((s) => s.clipperId === c.id && s.status === "approved" && !s.payoutId);
      const ready = mine.filter((s) => now >= payableFrom(s));
      const waiting = mine.filter((s) => now < payableFrom(s));
      const sum = (l: Submission[]) => l.reduce((n, s) => n + (s.amount ?? 0), 0);
      return { c, ready, waiting, readyAmount: sum(ready), waitingAmount: sum(waiting) };
    })
    .filter((r) => r.ready.length || r.waiting.length)
    .sort((a, b) => b.readyAmount - a.readyAmount);

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([payoutsCsv(payouts.filter((p) => p.status === "owed"), clippers)], { type: "text/csv" }));
    a.download = `clipper-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const open = payouts.filter((p) => p.status === "owed");
  const done = payouts.filter((p) => p.status === "paid").sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
        Approved posts become payable {HOLD_DAYS} days after they went up: long enough for the platforms to clear out fake views, which then show up
        as views going down. Pay from here, send the money however you pay them, then mark it paid. The money itself never goes through the hub.
      </p>

      <Card title="Owed" description="Approved posts not in a payout yet">
        {owed.length ? (
          <ul className="divide-y divide-line border-t border-line" data-payouts-owed>
            {owed.map((r) => (
              <li key={r.c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink">{r.c.name}</span>
                  <span className="block text-faint">{r.c.payoutNote || "How they're paid isn't set"}</span>
                </span>
                {r.waiting.length > 0 && (
                  <span className="text-faint">
                    {money(r.waitingAmount)} on hold ({r.waiting.length})
                  </span>
                )}
                <span className="w-24 text-right font-medium tabular-nums text-ink">{money(r.readyAmount)}</span>
                <Button size="sm" variant="primary" disabled={!r.ready.length} onClick={() => pay(r.c.id, r.ready)} data-payouts-pay>
                  <Wallet className="size-3.5" /> Pay {r.ready.length} post{r.ready.length === 1 ? "" : "s"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 pt-2 text-xs text-faint">Nothing owed. Approve posts on the Review tab.</p>
        )}
      </Card>

      <Card
        title="To send"
        description="Payouts made here, waiting to be marked paid"
        action={
          open.length ? (
            <Button size="sm" onClick={download}>
              <Download className="size-3.5" /> Spreadsheet
            </Button>
          ) : undefined
        }
      >
        {open.length ? (
          <ul className="divide-y divide-line border-t border-line" data-payouts-open>
            {open.map((p) => {
              const c = clippers.find((x) => x.id === p.clipperId);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink">{c?.name}</span>
                    <span className="flex items-center gap-2 text-faint">
                      {c?.payoutNote || "How they're paid isn't set"}
                      {c?.payoutNote && <CopyButton text={c.payoutNote} label="Copy" />}
                    </span>
                  </span>
                  <span className="text-faint">
                    {p.submissionIds.length} posts · {p.usViews.toLocaleString()} US views
                  </span>
                  <span className="w-24 text-right font-medium tabular-nums text-ink">{money(p.amount)}</span>
                  <Button size="sm" onClick={() => markPaid(p.id)} data-payouts-mark>
                    Mark paid
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 pb-4 pt-2 text-xs text-faint">None waiting.</p>
        )}
      </Card>

      {done.length > 0 && (
        <Card title="Paid">
          <ul className="divide-y divide-line border-t border-line">
            {done.slice(0, 30).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className="flex-1 text-ink">{clippers.find((x) => x.id === p.clipperId)?.name}</span>
                <span className="text-faint">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ""}</span>
                <Badge tone="good">{money(p.amount)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {!owed.length && !payouts.length && <Empty>Payouts show here once posts are approved.</Empty>}
    </div>
  );
}
