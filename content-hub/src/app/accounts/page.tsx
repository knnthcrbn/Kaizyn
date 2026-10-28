"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Plug, Plus, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FieldLabel, PlatformChips, PlatformDot } from "@/components/plan/bits";
import { ScheduleDialog } from "@/components/plan/ScheduleDialog";
import { Badge, Button, Card, ConfirmAction, Empty, PageHeader, cx, inputCls, selectCls } from "@/components/ui";
import { PILLARS, pillarLabel } from "@/lib/meta";
import { weekStart } from "@/lib/metrics";
import { isUS } from "@/lib/clipping";
import { PLATFORMS, parseHandles, platformLabel } from "@/lib/plan";
import { useHub } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import type { Account, Pillar, Platform } from "@/lib/types";

const DAY = 86_400_000;

const groupName = (a: Account) => a.group.trim() || (a.kind === "main" ? "Main accounts" : "Clipping pages");

export default function AccountsPage() {
  const accounts = useHub((s) => s.accounts);
  const posts = useHub((s) => s.posts);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [filter, setFilter] = useState<Platform[]>([]);

  const week = weekStart(useNow());
  const thisWeek = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) if (p.accountId && p.at >= week && p.at < week + 7 * DAY && p.status !== "skipped") m.set(p.accountId, (m.get(p.accountId) ?? 0) + 1);
    return m;
  }, [posts, week]);

  const shown = filter.length ? accounts.filter((a) => filter.includes(a.platform)) : accounts;
  const groups = useMemo(() => {
    const m = new Map<string, Account[]>();
    for (const a of [...shown].sort((x, y) => (x.kind === y.kind ? x.handle.localeCompare(y.handle, undefined, { numeric: true }) : x.kind === "main" ? -1 : 1))) {
      const key = `${a.platform}::${groupName(a)}`;
      m.set(key, [...(m.get(key) ?? []), a]);
    }
    return [...m].sort(([a], [b]) => a.localeCompare(b));
  }, [shown]);
  const platforms = PLATFORMS.filter((p) => accounts.some((a) => a.platform === p.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Your main profiles and every clipping page, grouped so one video can go to a whole group at once, at staggered times, each with its own caption."
        actions={
          <>
            {accounts.length > 0 && (
              <Button onClick={() => setScheduling(true)}>
                <CalendarPlus className="size-3.5" /> Schedule a post
              </Button>
            )}
            <Button variant="primary" onClick={() => setAdding(true)} data-accounts-add>
              <Plus className="size-3.5" /> Add accounts
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-start gap-3 p-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2">
            <Plug className="size-4 text-muted" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
              Posting <Badge tone="warning">Checklist for now</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-faint">
              Scheduled posts show up on Today and the Calendar at their time, with the caption to copy and the account to post from. Whoever posts
              marks it done. No passwords or logins are kept here. Connecting a posting service, so they go out on their own, is the last step on the
              roadmap.
            </p>
          </div>
          <Link href="/calendar" className="flex items-center gap-1 self-center text-xs text-faint hover:text-ink">
            Calendar <ArrowRight className="size-3" />
          </Link>
        </div>
      </Card>

      {accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <PlatformChips value={filter} onChange={setFilter} only={platforms.map((p) => p.id)} multi />
          <span className="text-xs text-faint">
            {accounts.length} account{accounts.length === 1 ? "" : "s"} ·{" "}
            {platforms.map((p) => `${accounts.filter((a) => a.platform === p.id).length} ${p.label}`).join(" · ")}
          </span>
        </div>
      )}

      {!accounts.length ? (
        <Empty>
          <Users className="mx-auto mb-2 size-5 text-ghost" />
          No accounts yet. Add your main profiles, then paste in your clipping pages (a hundred at a time is fine) and give them a group.
        </Empty>
      ) : (
        <div className="space-y-4" data-accounts-list>
          {groups.map(([key, list]) => {
            const [platform, name] = key.split("::") as [Platform, string];
            const active = list.filter((a) => a.active).length;
            return (
              <Card key={key}>
                <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                  <PlatformDot platform={platform} />
                  <span className="text-[13px] font-medium text-ink">{name}</span>
                  <span className="text-xs text-faint">
                    {platformLabel(platform)} · {list.length} account{list.length === 1 ? "" : "s"}
                    {active < list.length ? `, ${list.length - active} paused` : ""}
                  </span>
                </header>
                <ul className="grid divide-line sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => setEditing(a.id)}
                        className={cx("flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-surface-2", !a.active && "opacity-50")}
                      >
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">@{a.handle}</span>
                        {a.kind === "main" && <Badge tone="brand">Main</Badge>}
                        {a.basedIn && <Badge tone={isUS(a.basedIn) ? "good" : "critical"}>{a.basedIn}</Badge>}
                        {a.pillars.length > 0 && <span className="hidden text-[11px] text-faint sm:inline">{a.pillars.map(pillarLabel).join(", ")}</span>}
                        {thisWeek.get(a.id) ? <span className="text-[11px] tabular-nums text-faint">{thisWeek.get(a.id)} this week</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {adding && <AddAccounts onClose={() => setAdding(false)} />}
      {editing && <EditAccount id={editing} onClose={() => setEditing(null)} />}
      {scheduling && <ScheduleDialog onClose={() => setScheduling(false)} />}
    </div>
  );
}

function PillarPicker({ value, onChange }: { value: Pillar[]; onChange: (v: Pillar[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PILLARS.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
            className={cx("h-7 rounded-md border px-2.5 text-xs", on ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-ink")}
            aria-pressed={on}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function AddAccounts({ onClose }: { onClose: () => void }) {
  const accounts = useHub((s) => s.accounts);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [kind, setKind] = useState<Account["kind"]>("clipping");
  const [group, setGroup] = useState("");
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [text, setText] = useState("");
  const groups = [...new Set(accounts.map((a) => a.group).filter(Boolean))];
  const handles = parseHandles(text);
  const have = new Set(accounts.filter((a) => a.platform === platform).map((a) => a.handle.toLowerCase()));
  const fresh = handles.filter((h) => !have.has(h.toLowerCase()));

  const add = () => {
    useHub.getState().addRecords(
      "accounts",
      fresh.map((handle) => ({ platform, handle, kind, group: group.trim(), pillars, active: true, notes: "" })),
    );
    onClose();
  };

  return (
    <Modal title="Add accounts" onClose={onClose} className="max-w-lg">
      <div className="space-y-4 overflow-y-auto p-4">
        <div>
          <FieldLabel>Platform</FieldLabel>
          <PlatformChips value={[platform]} onChange={([p]) => setPlatform(p)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>Type</FieldLabel>
            <select value={kind} onChange={(e) => setKind(e.target.value as Account["kind"])} className={cx(selectCls, "w-full")}>
              <option value="main">Main account</option>
              <option value="clipping">Clipping page</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Group</FieldLabel>
            <input list="account-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder={kind === "main" ? "Main accounts" : "IG clips A"} className={cx(inputCls, "h-8 py-0")} />
            <datalist id="account-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
        </div>
        <div>
          <FieldLabel>What they post (optional)</FieldLabel>
          <PillarPicker value={pillars} onChange={setPillars} />
        </div>
        <label className="block">
          <FieldLabel>Handles or links, one per line</FieldLabel>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className={cx(inputCls, "resize-y font-mono text-xs")} placeholder={"@yourname\nclips.page.one\ninstagram.com/clips.page.two"} data-accounts-handles />
        </label>
        <p className="text-[11px] text-ghost">
          {handles.length ? `${fresh.length} new${handles.length > fresh.length ? `, ${handles.length - fresh.length} already added` : ""}.` : "Paste as many as you like."} Only the
          handle is saved: no passwords.
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={add} disabled={!fresh.length} data-accounts-save>
          Add {fresh.length || ""} account{fresh.length === 1 ? "" : "s"}
        </Button>
      </div>
    </Modal>
  );
}

function EditAccount({ id, onClose }: { id: string; onClose: () => void }) {
  const a = useHub((s) => s.accounts.find((x) => x.id === id));
  const accounts = useHub((s) => s.accounts);
  const clippers = useHub((s) => s.clippers);
  if (!a) return null;
  const set = (patch: Partial<Account>) => useHub.getState().updateRecord("accounts", a.id, patch);
  const groups = [...new Set(accounts.map((x) => x.group).filter(Boolean))];
  return (
    <Modal title={`@${a.handle}`} onClose={onClose} className="max-w-md">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>Handle</FieldLabel>
            <input value={a.handle} onChange={(e) => set({ handle: e.target.value.replace(/^@/, "") })} className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>Type</FieldLabel>
            <select value={a.kind} onChange={(e) => set({ kind: e.target.value as Account["kind"] })} className={cx(selectCls, "w-full")}>
              <option value="main">Main account</option>
              <option value="clipping">Clipping page</option>
            </select>
          </label>
        </div>
        <label className="block">
          <FieldLabel>Group</FieldLabel>
          <input list="account-groups-edit" value={a.group} onChange={(e) => set({ group: e.target.value })} className={cx(inputCls, "h-8 py-0")} />
          <datalist id="account-groups-edit">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <div>
          <FieldLabel>What it posts</FieldLabel>
          <PillarPicker value={a.pillars} onChange={(pillars) => set({ pillars })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>Run by</FieldLabel>
            <select value={a.clipperId ?? ""} onChange={(e) => set({ clipperId: e.target.value || undefined })} className={cx(selectCls, "w-full")}>
              <option value="">The team</option>
              {clippers
                .filter((c) => c.status !== "removed")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Based in</FieldLabel>
            <input value={a.basedIn ?? ""} onChange={(e) => set({ basedIn: e.target.value || undefined, verifiedAt: undefined })} placeholder="From About this account" className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>Joined</FieldLabel>
            <input value={a.joined ?? ""} onChange={(e) => set({ joined: e.target.value || undefined })} placeholder="March 2026" className={cx(inputCls, "h-8 py-0")} />
          </label>
          <label className="block">
            <FieldLabel>Followers</FieldLabel>
            <input type="number" min={0} value={a.followers ?? ""} onChange={(e) => set({ followers: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })} className={cx(selectCls, "w-full")} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={!!a.verifiedAt} onChange={(e) => set({ verifiedAt: e.target.checked ? Date.now() : undefined })} className="accent-white" />
          Checked: where it&apos;s based matches its About this account screen
          {a.proof && (
            <a href={`/api/library/file?path=${encodeURIComponent(a.proof)}`} target="_blank" rel="noreferrer" className="text-faint underline underline-offset-2 hover:text-ink">
              see the screenshot
            </a>
          )}
        </label>
        <label className="block">
          <FieldLabel>Notes</FieldLabel>
          <textarea value={a.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className={cx(inputCls, "resize-y")} placeholder="Who runs it, its angle, anything to remember" />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={a.active} onChange={(e) => set({ active: e.target.checked })} className="accent-white" />
          Active (paused accounts aren&apos;t offered when scheduling)
        </label>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <ConfirmAction
          question="Remove this account?"
          confirmLabel="Remove"
          onConfirm={() => {
            useHub.getState().deleteRecord("accounts", a.id);
            onClose();
          }}
          className="inline-flex items-center gap-1 text-xs text-faint hover:text-critical-text"
        >
          <Trash2 className="size-3.5" /> Remove
        </ConfirmAction>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
