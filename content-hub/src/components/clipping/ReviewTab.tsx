"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, ExternalLink, ShieldAlert, X } from "lucide-react";
import { NumberField, PlatformDot } from "@/components/plan/bits";
import { Badge, Button, Empty, Segmented, cx, inputCls } from "@/components/ui";
import { dropSpent, estimate, flagsFor, isUS, latest, money, payableFrom, riskOf, sortedSnaps, type FlagLevel } from "@/lib/clipping";
import { platformLabel } from "@/lib/meta";
import { useHub } from "@/lib/store";
import { syncNow } from "@/lib/sync";
import type { Submission } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { AccountRow, proofUrl } from "./ClippersTab";

type Show = "pending" | "approved" | "rejected" | "paid";
const RISK_TONE: Record<FlagLevel, "critical" | "warning" | "good"> = { high: "critical", medium: "warning", low: "good" };
const RISK_LABEL: Record<FlagLevel, string> = { high: "Likely fake", medium: "Check it", low: "Looks clean" };

/** Approving: US views at the rate, capped per post and by what's left of the clip's budget. */
export function approve(s: Submission, note?: string) {
  const hub = useHub.getState();
  const clipper = hub.clippers.find((c) => c.id === s.clipperId);
  const drop = hub.drops.find((d) => d.id === s.dropId);
  const e = estimate(s, clipper, drop);
  let amount = e.amount;
  if (drop?.budget != null) amount = Math.max(0, Math.min(amount, drop.budget - dropSpent(drop.id, hub.submissions.filter((x) => x.id !== s.id))));
  hub.updateRecord("submissions", s.id, { status: "approved", usViews: e.usViews, amount: Math.round(amount * 100) / 100, reviewNote: note || undefined });
}

export function ReviewTab() {
  const submissions = useHub((s) => s.submissions);
  const accounts = useHub((s) => s.accounts);
  const [show, setShow] = useState<Show>("pending");
  const [risk, setRisk] = useState<"all" | FlagLevel>("all");
  const now = useNow();

  // Clippers submit straight to the server; fetch what's arrived before reviewing.
  useEffect(() => {
    void syncNow().catch(() => {});
  }, []);

  const rows = useMemo(() => {
    const ctx = { submissions, accounts };
    return submissions
      .filter((s) => s.status === show)
      .map((s) => {
        const flags = flagsFor(s, ctx, now);
        return { s, flags, risk: riskOf(flags) };
      })
      .filter((r) => risk === "all" || r.risk === risk)
      .sort((a, b) => (show === "pending" ? ["high", "medium", "low"].indexOf(a.risk) - ["high", "medium", "low"].indexOf(b.risk) || a.s.createdAt - b.s.createdAt : b.s.updatedAt - a.s.updatedAt));
  }, [submissions, accounts, show, risk, now]);

  const clean = rows.filter((r) => r.s.status === "pending" && r.risk === "low" && now >= payableFrom(r.s));
  const counts = (st: Show) => submissions.filter((s) => s.status === st).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={show}
          onChange={setShow}
          options={[
            { value: "pending", label: `To check · ${counts("pending")}` },
            { value: "approved", label: `Approved · ${counts("approved")}` },
            { value: "rejected", label: `Rejected · ${counts("rejected")}` },
            { value: "paid", label: `Paid · ${counts("paid")}` },
          ]}
        />
        <Segmented
          value={risk}
          onChange={setRisk}
          options={[
            { value: "all", label: "All" },
            { value: "high", label: "Likely fake" },
            { value: "medium", label: "Check it" },
            { value: "low", label: "Clean" },
          ]}
        />
        {show === "pending" && clean.length > 0 && (
          <Button size="sm" variant="primary" className="ml-auto" onClick={() => clean.forEach((r) => approve(r.s))} data-review-approve-clean>
            <Check className="size-3.5" /> Approve {clean.length} clean post{clean.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>
      {rows.length ? (
        <div className="space-y-3" data-review-list>
          {rows.map((r) => (
            <SubmissionCard key={r.s.id} sub={r.s} flags={r.flags} risk={r.risk} />
          ))}
        </div>
      ) : (
        <Empty>{show === "pending" ? "Nothing waiting. Posts clippers send from their links show up here." : "Nothing here."}</Empty>
      )}
    </div>
  );
}

function SubmissionCard({ sub, flags, risk }: { sub: Submission; flags: ReturnType<typeof flagsFor>; risk: FlagLevel }) {
  const clipper = useHub((s) => s.clippers.find((c) => c.id === sub.clipperId));
  const drop = useHub((s) => s.drops.find((d) => d.id === sub.dropId));
  const account = useHub((s) => s.accounts.find((a) => a.id === sub.accountId));
  const [note, setNote] = useState(sub.reviewNote ?? "");
  const [fix, setFix] = useState<{ views?: number; us?: number } | null>(null);
  const n = latest(sub);
  const e = estimate(sub, clipper, drop);
  const proofs = sortedSnaps(sub).flatMap((x) => x.proofs ?? []);
  const set = (patch: Partial<Submission>) => useHub.getState().updateRecord("submissions", sub.id, patch);

  return (
    <section className={cx("rounded-xl border bg-surface", risk === "high" ? "border-critical/40" : "border-line")} data-review-item>
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <PlatformDot platform={sub.platform} />
        <span className="text-[13px] font-medium text-ink">{clipper?.name ?? "Unknown clipper"}</span>
        <span className="text-xs text-faint">
          {account ? `@${account.handle}` : platformLabel(sub.platform)} · {drop?.title ?? "No clip"} · posted {new Date(sub.postedAt).toLocaleDateString()}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {sub.status === "pending" && <Badge tone={RISK_TONE[risk]}>{RISK_LABEL[risk]}</Badge>}
          <a href={sub.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink">
            Post <ExternalLink className="size-3" />
          </a>
        </span>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
            {(
              [
                ["Views", n.views],
                ["Likes", n.likes],
                ["Comments", n.comments],
                ["Shares", n.shares],
                ["Saves", n.saves],
                ["Reached", n.reach],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <div className="text-[10px] text-faint">{label}</div>
                <div className="tabular-nums text-ink">{v == null ? "–" : v.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="text-xs">
            <div className="text-[10px] text-faint">Where viewers are</div>
            {n.topCountries?.length ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {n.topCountries.map((c) => (
                  <span key={c.country} className={cx("rounded-md px-1.5 py-0.5 tabular-nums", isUS(c.country) ? "bg-good/12 text-good-text" : "bg-surface-3 text-muted")}>
                    {c.country} {c.pct}%
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-faint">Not shown</div>
            )}
          </div>
          {proofs.length > 0 && (
            <div className="flex flex-wrap gap-2" data-review-proofs>
              {proofs.map((p) => (
                <a key={p} href={proofUrl(p)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofUrl(p)} alt="Proof screenshot" className="h-32 rounded-lg border border-line object-cover hover:border-line-strong" />
                </a>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ghost">
            {sub.snapshots.length} reading{sub.snapshots.length === 1 ? "" : "s"}, latest {new Date(sortedSnaps(sub).at(-1)?.at ?? sub.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="space-y-3">
          {flags.length > 0 && (
            <ul className="space-y-1.5" data-review-flags>
              {flags.map((f, i) => (
                <li key={`${f.id}-${i}`} className={cx("flex items-start gap-2 text-xs", f.level === "high" ? "text-critical-text" : f.level === "medium" ? "text-warning" : "text-faint")}>
                  {f.level === "high" ? <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 size-3.5 shrink-0" />}
                  {f.text}
                </li>
              ))}
            </ul>
          )}
          {account && (
            <ul className="rounded-lg border border-line">
              <AccountRow account={account} />
            </ul>
          )}
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted" data-review-estimate>
            {e.usShare == null ? (
              "No country breakdown: nothing to pay until there is one."
            ) : (
              <>
                {e.views.toLocaleString()} views × {Math.round(e.usShare * 100)}% US = <b className="text-ink">{e.usViews.toLocaleString()} US views</b>, worth{" "}
                <b className="text-ink">{money(sub.status === "pending" ? e.amount : (sub.amount ?? 0))}</b>
                {drop?.capPerPost != null && e.amount >= drop.capPerPost ? " (capped)" : ""}
              </>
            )}
          </div>
          {sub.status === "pending" ? (
            <>
              {fix ? (
                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <NumberField label="Views" value={fix.views} onChange={(views) => setFix((f) => ({ ...f, views }))} />
                  <NumberField label="% from the US" suffix="%" max={100} value={fix.us} onChange={(us) => setFix((f) => ({ ...f, us }))} />
                  <Button
                    size="sm"
                    onClick={() => {
                      set({
                        snapshots: [
                          ...sub.snapshots,
                          { at: Date.now(), source: "manual", views: fix.views, usShare: fix.us != null ? fix.us / 100 : undefined },
                        ],
                      });
                      setFix(null);
                    }}
                  >
                    Use
                  </Button>
                </div>
              ) : (
                <button onClick={() => setFix({ views: n.views, us: n.usShare != null ? Math.round(n.usShare * 100) : undefined })} className="text-xs text-faint hover:text-ink">
                  Correct the numbers
                </button>
              )}
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for the clipper (they see it)" className={cx(inputCls, "h-8 py-0 text-xs")} />
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => approve(sub, note)} disabled={e.usShare == null} data-review-approve>
                  <Check className="size-3.5" /> Approve {money(e.amount)}
                </Button>
                <Button className="flex-1" onClick={() => set({ status: "rejected", reviewNote: note || "Didn't pass the check.", amount: 0, usViews: 0 })} data-review-reject>
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-xs text-faint">
              {sub.reviewNote && <span className="flex-1">Note: {sub.reviewNote}</span>}
              {sub.status !== "paid" && !sub.payoutId && (
                <button onClick={() => set({ status: "pending" })} className="ml-auto hover:text-ink">
                  Back to checking
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
