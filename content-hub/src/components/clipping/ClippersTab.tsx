"use client";

import { useState } from "react";
import { BadgeCheck, Check, Copy, KeyRound, Plus, UserPlus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FieldLabel, PlatformDot } from "@/components/plan/bits";
import { Badge, Button, ConfirmAction, Empty, cx, inputCls, selectCls } from "@/components/ui";
import { clipperStats, isUS, money, newKey } from "@/lib/clipping";
import { platformLabel } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { Account, Clipper } from "@/lib/types";
import { useNow } from "@/lib/useNow";

export const proofUrl = (p: string) => `/api/library/file?path=${encodeURIComponent(p)}`;
export const portalLink = (c: Pick<Clipper, "key">) => `${typeof window === "undefined" ? "" : window.location.origin}/clip#k=${c.key}`;

const monthStart = (now: number) => {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className={cx("inline-flex items-center gap-1 text-xs text-faint hover:text-ink", className)}
    >
      {done ? <Check className="size-3.5 text-good-text" /> : <Copy className="size-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

export function ClippersTab() {
  const clippers = useHub((s) => s.clippers);
  const submissions = useHub((s) => s.submissions);
  const accounts = useHub((s) => s.accounts);
  const drops = useHub((s) => s.drops);
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const since = monthStart(now);
  const list = clippers.filter((c) => c.status !== "removed").sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          Each clipper gets a private link: the clips to post, the accounts they run, and their posts and money. Nothing else of the hub. They&apos;re paid
          per 1,000 views from the United States, after the numbers are checked.
        </p>
        <Button variant="primary" onClick={() => setAdding(true)} data-clippers-add>
          <UserPlus className="size-3.5" /> Add a clipper
        </Button>
      </div>
      {list.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[820px] text-xs" data-clippers>
            <thead>
              <tr className="border-b border-line bg-surface text-left text-[11px] text-faint">
                <th className="px-3 py-2 font-medium">Clipper</th>
                <th className="px-3 py-2 font-medium">Rate</th>
                <th className="px-3 py-2 text-right font-medium">Accounts (US)</th>
                <th className="px-3 py-2 text-right font-medium">Posts this month</th>
                <th className="px-3 py-2 text-right font-medium">US views</th>
                <th className="px-3 py-2 text-right font-medium">Flagged</th>
                <th className="px-3 py-2 text-right font-medium">Owed</th>
                <th className="px-3 py-2 font-medium">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => {
                const st = clipperStats(c, { submissions, accounts, drops }, since);
                return (
                  <tr key={c.id} className="bg-bg hover:bg-surface-2">
                    <td className="px-3 py-2">
                      <button onClick={() => setOpen(c.id)} className="text-left">
                        <span className="block text-ink hover:underline">{c.name}</span>
                        <span className="block text-[11px] text-faint">
                          {c.country || "Country not given"}
                          {c.status === "paused" && " · paused"}
                          {!c.acceptedRulesAt && " · hasn't opened their link"}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">{money(c.cpm)}/1k</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {st.accounts} <span className={st.usAccounts < st.accounts ? "text-warning" : "text-faint"}>({st.usAccounts})</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{st.posts}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{st.usViews.toLocaleString()}</td>
                    <td className={cx("px-3 py-2 text-right tabular-nums", st.flagged ? "text-critical-text" : "text-faint")}>{st.flagged}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{money(st.owed)}</td>
                    <td className="px-3 py-2">
                      <CopyButton text={portalLink(c)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No clippers yet. Add one and send them their link: they add the accounts they run, then post the clips you drop.</Empty>
      )}
      {adding && <AddClipper onClose={() => setAdding(false)} onAdded={setOpen} />}
      {open && <ClipperDialog id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AddClipper({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [country, setCountry] = useState("United States");
  const [cpm, setCpm] = useState(1);
  return (
    <Modal title="Add a clipper" onClose={onClose} className="max-w-md">
      <div className="space-y-3 p-4">
        <label className="block">
          <FieldLabel>Name</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} className={cx(inputCls, "h-8 py-0")} data-clipper-name />
        </label>
        <label className="block">
          <FieldLabel>Contact</FieldLabel>
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email, phone or handle" className={cx(inputCls, "h-8 py-0")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>Lives in</FieldLabel>
            <input value={country} onChange={(e) => setCountry(e.target.value)} className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>$ per 1,000 US views</FieldLabel>
            <input type="number" min={0} step={0.05} value={cpm} onChange={(e) => setCpm(Math.max(0, Number(e.target.value) || 0))} className={cx(selectCls, "w-full")} data-clipper-cpm />
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!name.trim()}
          onClick={() => {
            const id = useHub.getState().addRecord("clippers", { name: name.trim(), contact: contact.trim(), country: country.trim(), cpm, status: "active", key: newKey(), payoutNote: "", notes: "" });
            onClose();
            onAdded(id);
          }}
          data-clipper-save
        >
          <Plus className="size-3.5" /> Add and make their link
        </Button>
      </div>
    </Modal>
  );
}

function ClipperDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useHub((s) => s.clippers.find((x) => x.id === id));
  const allAccounts = useHub((s) => s.accounts);
  const submissions = useHub((s) => s.submissions);
  const drops = useHub((s) => s.drops);
  if (!c) return null;
  const set = (patch: Partial<Clipper>) => useHub.getState().updateRecord("clippers", c.id, patch);
  const accounts = allAccounts.filter((a) => a.clipperId === c.id);
  const st = clipperStats(c, { submissions, accounts: allAccounts, drops });
  return (
    <Modal title={c.name} onClose={onClose} className="max-w-2xl">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4" data-clipper-dialog>
        <section className="space-y-2 rounded-lg border border-line p-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <KeyRound className="size-3.5" /> Their private link
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-[11px] text-muted" data-clipper-link>
              {portalLink(c)}
            </code>
            <CopyButton text={portalLink(c)} />
            <ConfirmAction question="Lock the old link out?" confirmLabel="New link" onConfirm={() => set({ key: newKey() })} className="text-xs text-faint hover:text-ink">
              New link
            </ConfirmAction>
          </div>
          <p className="text-[11px] text-ghost">Anyone with this link sees this clipper&apos;s portal. If it gets shared, make a new one.</p>
        </section>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Posts" value={String(st.posts)} />
          <Mini label="Verified US views" value={st.usViews.toLocaleString()} />
          <Mini label="Earned" value={money(st.earned)} />
          <Mini label="Flagged" value={String(st.flagged)} warn={st.flagged > 0} />
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Contact</FieldLabel>
            <input value={c.contact} onChange={(e) => set({ contact: e.target.value })} className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>Lives in</FieldLabel>
            <input value={c.country} onChange={(e) => set({ country: e.target.value })} className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>$ per 1,000 US views</FieldLabel>
            <input type="number" min={0} step={0.05} value={c.cpm} onChange={(e) => set({ cpm: Math.max(0, Number(e.target.value) || 0) })} className={cx(selectCls, "w-full")} />
          </label>
          <label className="block">
            <FieldLabel>Status</FieldLabel>
            <select value={c.status} onChange={(e) => set({ status: e.target.value as Clipper["status"] })} className={cx(selectCls, "w-full")}>
              <option value="active">Active</option>
              <option value="paused">Paused (sees the portal, can&apos;t add posts)</option>
              <option value="removed">Removed (link stops working)</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>How they&apos;re paid</FieldLabel>
            <input value={c.payoutNote} onChange={(e) => set({ payoutNote: e.target.value })} placeholder="PayPal: name@…, Wise, Zelle… (never bank details here)" className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Notes</FieldLabel>
            <textarea value={c.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={cx(inputCls, "resize-y")} />
          </label>
        </section>

        <section>
          <FieldLabel>Accounts they run · {accounts.length}</FieldLabel>
          {accounts.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {accounts.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-faint">None yet. They add them from their link, with a screenshot of About this account.</p>
          )}
        </section>
        <p className="text-[11px] text-ghost">{c.acceptedRulesAt ? `Agreed to the rules ${new Date(c.acceptedRulesAt).toLocaleDateString()}.` : "Hasn't agreed to the rules yet (they can't post until they do)."}</p>
      </div>
      <div className="flex justify-end border-t border-line px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <div className="text-[11px] text-faint">{label}</div>
      <div className={cx("text-[15px] font-semibold tabular-nums", warn ? "text-critical-text" : "text-ink")}>{value}</div>
    </div>
  );
}

/** One account with where it's based, its proof, and confirming it by eye. */
export function AccountRow({ account: a }: { account: Account }) {
  const set = (patch: Partial<Account>) => useHub.getState().updateRecord("accounts", a.id, patch);
  return (
    <li className="space-y-1 px-3 py-2 text-xs" data-account-row>
      <div className="flex flex-wrap items-center gap-2">
        <PlatformDot platform={a.platform} />
        <span className="text-ink">@{a.handle}</span>
        <span className="text-faint">{platformLabel(a.platform)}</span>
        {a.basedIn ? (
          <Badge tone={isUS(a.basedIn) ? "good" : "critical"}>Based in {a.basedIn}</Badge>
        ) : (
          <Badge tone="warning">Where it&apos;s based not shown</Badge>
        )}
        {a.joined && <span className="text-faint">joined {a.joined}</span>}
        {a.followers != null && <span className="text-faint">{a.followers.toLocaleString()} followers</span>}
        <span className="ml-auto flex items-center gap-2">
          {a.proof && (
            <a href={proofUrl(a.proof)} target="_blank" rel="noreferrer" className="text-faint hover:text-ink">
              Proof
            </a>
          )}
          {a.verifiedAt ? (
            <span className="inline-flex items-center gap-1 text-good-text">
              <BadgeCheck className="size-3.5" /> Checked
            </span>
          ) : (
            <button onClick={() => set({ verifiedAt: Date.now() })} className="text-faint hover:text-ink" data-account-verify>
              Mark checked
            </button>
          )}
        </span>
      </div>
      {a.notes && <p className="text-[11px] text-warning">{a.notes}</p>}
    </li>
  );
}
