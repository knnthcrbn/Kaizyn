"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, Check, Copy, Download, ImagePlus, LoaderCircle, Plus, ShieldAlert, Trophy, Upload, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Badge, Button, Segmented, cx, inputCls, selectCls } from "@/components/ui";
import { isUS } from "@/lib/clipping";
import { PLATFORMS, platformLabel } from "@/lib/meta";
import type { PortalView } from "@/lib/clipServer";
import type { Platform } from "@/lib/types";
import { useNow } from "@/lib/useNow";

// The clipper portal: what a clipper sees from their private link. It talks
// only to /api/clip/*, with the key from the link, and holds nothing of the
// hub. Built for a phone: grab the clip, post it, send the proof.

type Tab = "clips" | "posts" | "accounts" | "board";

const money = (n: number) => `$${n.toFixed(2)}`;
const count = (n?: number) => (n == null ? "–" : n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString());

/** The key from the link: #k=… (kept out of server logs) or ?k=… */
function readKey() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return hash.get("k") ?? new URLSearchParams(window.location.search).get("k") ?? "";
}

/** Phone screenshots are big; this sends a sharp, much smaller JPEG. */
async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ClipPortal() {
  // Read once in the browser; the server render has no key and shows the loader either way.
  const [key] = useState(() => (typeof window === "undefined" ? "" : readKey()));
  const [view, setView] = useState<PortalView | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("clips");
  const [posting, setPosting] = useState<string | null | undefined>(undefined);
  const [updating, setUpdating] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const api = useCallback(
    async (path: string, body?: unknown) => {
      const res = await fetch(`/api/clip${path}`, {
        method: body ? "POST" : "GET",
        headers: { "x-clip-key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Something went wrong (${res.status}).`);
      return data;
    },
    [key],
  );

  const load = useCallback(async () => {
    try {
      setView(await api(""));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  // A missing key comes back from the server as an error, shown like any other.
  useEffect(() => {
    let live = true;
    api("").then(
      (v) => live && setView(v),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [api]);

  if (!view) {
    return (
      <Shell>
        <div className="grid min-h-[50vh] place-items-center text-center">
          {error ? <p className="max-w-sm text-[13px] text-muted">{error}</p> : <LoaderCircle className="size-5 animate-spin text-faint" />}
        </div>
      </Shell>
    );
  }

  const { clipper, totals } = view;
  return (
    <Shell>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink" data-portal-name>
          Hi {clipper.name.split(/\s+/)[0]}
        </h1>
        <p className="text-[13px] text-muted">
          {money(clipper.cpm)} per 1,000 views from the United States.
          {clipper.status === "paused" && <span className="text-warning"> Your account is paused: you can see everything, but can&apos;t add posts.</span>}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Money label="Being checked" value={totals.pending} hint="estimate" />
        <Money label="Approved" value={totals.owed} hint="to be paid" />
        <Money label="Paid" value={totals.paid} />
      </div>

      {!clipper.acceptedRulesAt && <Rules text={view.rules} onAccept={async () => (await api("/rules", {}), load())} />}

      <Segmented
        value={tab}
        onChange={setTab}
        className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:whitespace-nowrap [&>button]:px-1.5"
        options={[
          { value: "clips", label: <Count label="Clips" n={view.drops.length} /> },
          { value: "posts", label: <Count label="Posts" n={view.posts.length} /> },
          { value: "accounts", label: <Count label="Accounts" n={view.accounts.length} /> },
          { value: "board", label: "Top" },
        ]}
      />

      {tab === "clips" &&
        (view.drops.length ? (
          <div className="space-y-4" data-portal-drops>
            {view.drops.map((d) => (
              <DropCard key={d.id} drop={d} k={key} canPost={!!clipper.acceptedRulesAt && clipper.status === "active"} onPosted={() => setPosting(d.id)} />
            ))}
          </div>
        ) : (
          <Empty>No clips to post right now. New ones show up here.</Empty>
        ))}

      {tab === "posts" && (
        <div className="space-y-2" data-portal-posts>
          {clipper.acceptedRulesAt && clipper.status === "active" && (
            <Button className="w-full" onClick={() => setPosting(null)}>
              <Plus className="size-3.5" /> Add a post
            </Button>
          )}
          {view.posts.length ? (
            view.posts.map((p) => <PostRow key={p.id} post={p} accounts={view.accounts} onUpdate={() => setUpdating(p.id)} />)
          ) : (
            <Empty>Nothing submitted yet. Post a clip, then send its link and a screenshot of its insights.</Empty>
          )}
        </div>
      )}

      {tab === "accounts" && (
        <div className="space-y-2" data-portal-accounts>
          {clipper.status === "active" && (
            <Button className="w-full" onClick={() => setAdding(true)} data-portal-add-account>
              <Plus className="size-3.5" /> Add an account you run
            </Button>
          )}
          {view.accounts.length ? (
            view.accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">@{a.handle}</span>
                  <span className="block text-[11px] text-faint">
                    {platformLabel(a.platform)}
                    {a.joined ? ` · joined ${a.joined}` : ""}
                    {a.followers != null ? ` · ${count(a.followers)} followers` : ""}
                  </span>
                </span>
                {a.basedIn ? (
                  <span className={cx("text-[11px]", isUS(a.basedIn) ? "text-good-text" : "text-warning")}>{a.basedIn}</span>
                ) : (
                  <span className="text-[11px] text-ghost">Where it&apos;s based not shown</span>
                )}
                {a.verified && <BadgeCheck className="size-4 text-good-text" aria-label="Checked" />}
              </div>
            ))
          ) : (
            <Empty>Add each account you post from, with a screenshot of its About this account screen.</Empty>
          )}
        </div>
      )}

      {tab === "board" && (
        <div className="rounded-xl border border-line bg-surface" data-portal-board>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] text-ink">
            <Trophy className="size-4 text-warning" /> This month, by verified US views
            {view.rank > 0 && <span className="ml-auto text-xs text-faint">You&apos;re #{view.rank}</span>}
          </div>
          <ol className="divide-y divide-line">
            {view.board.map((b, i) => (
              <li key={i} className={cx("flex items-center gap-3 px-4 py-2 text-xs", b.name === "You" && "bg-surface-2")}>
                <span className="w-5 tabular-nums text-faint">{i + 1}</span>
                <span className="flex-1 text-ink">{b.name}</span>
                <span className="tabular-nums text-muted">{count(b.usViews)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {posting !== undefined && (
        <SubmitSheet view={view} dropId={posting} api={api} onClose={() => setPosting(undefined)} onDone={() => (setTab("posts"), load())} />
      )}
      {updating && <UpdateSheet postId={updating} api={api} onClose={() => setUpdating(null)} onDone={load} />}
      {adding && <AccountSheet api={api} onClose={() => setAdding(false)} onDone={load} />}
    </Shell>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <>
      {label} <span className="tabular-nums text-ghost">{n}</span>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
        <div className="flex items-center gap-2 text-xs text-faint">
          <span className="grid size-6 place-items-center rounded-md bg-brand">
            <BrandMark className="size-4" />
          </span>
          Clipping
        </div>
        {children}
      </div>
    </div>
  );
}

function Money({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{money(value)}</div>
      {hint && <div className="text-[10px] text-ghost">{hint}</div>}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-xs leading-relaxed text-faint">{children}</p>;
}

function Rules({ text, onAccept }: { text: string; onAccept: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4" data-portal-rules>
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <ShieldAlert className="size-4 text-warning" /> The rules
      </div>
      <div className="space-y-1 text-xs leading-relaxed text-muted">
        {text.split("\n").map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <Button variant="primary" disabled={busy} onClick={async () => (setBusy(true), await onAccept().finally(() => setBusy(false)))} data-portal-accept>
        <Check className="size-3.5" /> I agree
      </Button>
    </section>
  );
}

function CopyLine({ text }: { text: string }) {
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
      className="flex w-full items-start gap-2 rounded-lg border border-line px-3 py-2 text-left text-xs text-ink hover:bg-surface-2"
    >
      <span className="flex-1 whitespace-pre-wrap">{text}</span>
      {done ? <Check className="mt-0.5 size-3.5 shrink-0 text-good-text" /> : <Copy className="mt-0.5 size-3.5 shrink-0 text-faint" />}
    </button>
  );
}

function DropCard({ drop, k, canPost, onPosted }: { drop: PortalView["drops"][number]; k: string; canPost: boolean; onPosted: () => void }) {
  const src = `/api/clip/file?k=${encodeURIComponent(k)}&drop=${drop.id}`;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface" data-portal-drop>
      {drop.video && (
        <video src={src} poster={drop.video.poster} controls playsInline preload="none" className="max-h-[60vh] w-full bg-black" />
      )}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-ink">{drop.title}</h2>
          <Badge tone="good">{money(drop.cpm)} / 1k US views</Badge>
          {drop.capPerPost != null && <Badge>up to {money(drop.capPerPost)} a post</Badge>}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-faint">
          Post on: {drop.platforms.map(platformLabel).join(", ")}
          {drop.posted > 0 && <span className="text-good-text">· you&apos;ve posted it {drop.posted}×</span>}
        </div>
        {drop.brief && <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">{drop.brief}</p>}
        {drop.hooks.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Hooks (tap to copy)</div>
            {drop.hooks.slice(0, 3).map((h) => (
              <CopyLine key={h} text={h} />
            ))}
          </div>
        )}
        {drop.captions.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Caption</div>
            <CopyLine text={drop.captions[0]} />
          </div>
        )}
        <div className="flex gap-2">
          {drop.video && (
            <a href={`${src}&download=1`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 text-[13px] font-medium text-ink hover:bg-surface-3">
              <Download className="size-3.5" /> Download
            </a>
          )}
          <Button variant="primary" className="flex-1" onClick={onPosted} disabled={!canPost} data-portal-posted>
            <Upload className="size-3.5" /> I posted it
          </Button>
        </div>
      </div>
    </section>
  );
}

const STATUS: Record<string, { label: string; tone: "neutral" | "good" | "critical" | "warning" }> = {
  pending: { label: "Being checked", tone: "warning" },
  approved: { label: "Approved", tone: "good" },
  paid: { label: "Paid", tone: "good" },
  rejected: { label: "Rejected", tone: "critical" },
};

function PostRow({ post, accounts, onUpdate }: { post: PortalView["posts"][number]; accounts: PortalView["accounts"]; onUpdate: () => void }) {
  const now = useNow();
  const acc = accounts.find((a) => a.id === post.accountId);
  const st = STATUS[post.status];
  return (
    <div className="space-y-1.5 rounded-xl border border-line bg-surface px-4 py-3" data-portal-post>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{post.dropTitle ?? "Post"}</span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="text-[11px] text-faint">
        {acc ? `@${acc.handle} · ` : ""}
        {platformLabel(post.platform)} · {new Date(post.postedAt).toLocaleDateString()}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{count(post.views)} views</span>
        <span>{post.usShare == null ? "US share not shown yet" : `${Math.round(post.usShare * 100)}% US · ${count(post.usViews)} US views`}</span>
        <span className="ml-auto font-medium tabular-nums text-ink">{money(post.amount)}</span>
      </div>
      {post.status === "pending" && now < post.payableFrom && (
        <p className="text-[11px] text-ghost">Payable from {new Date(post.payableFrom).toLocaleDateString()}, once checked.</p>
      )}
      {post.reviewNote && <p className="text-[11px] text-muted">Note: {post.reviewNote}</p>}
      <div className="flex gap-3 text-[11px]">
        <a href={post.url} target="_blank" rel="noreferrer" className="text-faint hover:text-ink">
          Open post
        </a>
        {(post.status === "pending" || post.status === "approved") && (
          <button onClick={onUpdate} className="text-faint hover:text-ink">
            Send new numbers
          </button>
        )}
      </div>
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-line-strong bg-surface p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-faint hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">{children}</div>;
}

/** Picking screenshots: previews, and they're shrunk before sending. */
function Shots({ shots, onChange, hint }: { shots: string[]; onChange: (s: string[]) => void; hint: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {shots.map((s, i) => (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s} alt="" className="h-28 rounded-lg border border-line object-cover" />
            <button onClick={() => onChange(shots.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-black text-white" aria-label="Remove">
              <X className="size-3" />
            </button>
          </div>
        ))}
        {shots.length < 4 && (
          <label className="grid h-28 w-24 cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong text-faint hover:text-ink">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-5" />}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              data-portal-shots
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])].slice(0, 4 - shots.length);
                e.target.value = "";
                setBusy(true);
                try {
                  onChange([...shots, ...(await Promise.all(files.map(compress)))]);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ghost">{hint}</p>
    </div>
  );
}

function Typed({ value, onChange }: { value: Record<string, number | undefined>; onChange: (v: Record<string, number | undefined>) => void }) {
  return (
    <details className="rounded-lg border border-line px-3 py-2">
      <summary className="cursor-pointer text-xs text-muted">Type the numbers too (optional)</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          ["views", "Views"],
          ["likes", "Likes"],
          ["comments", "Comments"],
          ["shares", "Shares"],
          ["usPercent", "% from the US"],
        ].map(([k, label]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[11px] text-faint">{label}</span>
            <input
              inputMode="numeric"
              value={value[k] ?? ""}
              onChange={(e) => onChange({ ...value, [k]: e.target.value.trim() ? Number(e.target.value.replace(/[,\s%]/g, "")) || undefined : undefined })}
              className={cx(inputCls, "h-8 py-0")}
            />
          </label>
        ))}
      </div>
    </details>
  );
}

const POST_HINT =
  "Screenshots of this post's insights: one with the views, likes, comments and shares, and one with where viewers are (Instagram: the post › View insights; TikTok: the post › ⋯ › Analytics › Viewers).";

function SubmitSheet({ view, dropId, api, onClose, onDone }: { view: PortalView; dropId: string | null; api: (p: string, b?: unknown) => Promise<unknown>; onClose: () => void; onDone: () => void }) {
  const [drop, setDrop] = useState(dropId ?? view.drops[0]?.id ?? "");
  const [accountId, setAccountId] = useState(view.accounts[0]?.id ?? "");
  const [url, setUrl] = useState("");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [shots, setShots] = useState<string[]>([]);
  const [typed, setTyped] = useState<Record<string, number | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ views?: number; usShare?: number; concerns: string[] } | null>(null);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const [y, m, d] = day.split("-").map(Number);
      const postedAt = Math.min(Date.now(), new Date(y, m - 1, d, 12).getTime());
      setDone((await api("/submit", { dropId: drop || undefined, accountId: accountId || undefined, url, postedAt, proofs: shots, typed })) as never);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Sheet title="Sent" onClose={onClose}>
        <div className="space-y-3 text-[13px] text-muted" data-portal-sent>
          <p>
            {/* The exact number read, so a misread is easy to spot. */}
            Read from your screenshots: <b className="text-ink">{done.views == null ? "no view count" : `${done.views.toLocaleString()} views`}</b>
            {done.usShare != null ? `, ${Math.round(done.usShare * 100)}% from the US` : ", no country breakdown yet"}.
          </p>
          {done.concerns.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-warning">
              {done.concerns.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <p className="text-xs">It&apos;s checked before it&apos;s paid. Send new numbers any time before then.</p>
          <Button variant="primary" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Add a post" onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <Label>Clip</Label>
          <select value={drop} onChange={(e) => setDrop(e.target.value)} className={cx(selectCls, "w-full")}>
            {view.drops.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
            <option value="">Something else</option>
          </select>
        </label>
        <label className="block">
          <Label>Posted from</Label>
          {view.accounts.length ? (
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={cx(selectCls, "w-full")} data-portal-account>
              {view.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle} · {platformLabel(a.platform)}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-warning">Add the account you post from first (Accounts tab).</p>
          )}
        </label>
        <label className="block">
          <Label>Link to the post</Label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" className={cx(inputCls, "h-9 py-0")} data-portal-url />
        </label>
        <label className="block">
          <Label>Posted on</Label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={cx(selectCls, "w-full")} />
        </label>
        <div>
          <Label>Proof</Label>
          <Shots shots={shots} onChange={setShots} hint={POST_HINT} />
        </div>
        <Typed value={typed} onChange={setTyped} />
        {error && <p className="text-xs text-critical-text">{error}</p>}
        <Button variant="primary" className="w-full" disabled={busy || !url.trim() || !shots.length || !view.accounts.length} onClick={send} data-portal-send>
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {busy ? "Reading your screenshots…" : "Send"}
        </Button>
      </div>
    </Sheet>
  );
}

function UpdateSheet({ postId, api, onClose, onDone }: { postId: string; api: (p: string, b?: unknown) => Promise<unknown>; onClose: () => void; onDone: () => void }) {
  const [shots, setShots] = useState<string[]>([]);
  const [typed, setTyped] = useState<Record<string, number | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet title="New numbers" onClose={onClose}>
      <div className="space-y-4">
        <Shots shots={shots} onChange={setShots} hint={POST_HINT} />
        <Typed value={typed} onChange={setTyped} />
        {error && <p className="text-xs text-critical-text">{error}</p>}
        <Button
          variant="primary"
          className="w-full"
          disabled={busy || !shots.length}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api("/update", { submissionId: postId, proofs: shots, typed });
              onDone();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Send
        </Button>
      </div>
    </Sheet>
  );
}

function AccountSheet({ api, onClose, onDone }: { api: (p: string, b?: unknown) => Promise<unknown>; onClose: () => void; onDone: () => void }) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [handle, setHandle] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet title="Add an account" onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <Label>Platform</Label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={cx(selectCls, "w-full")}>
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Label>Handle</Label>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourpage" className={cx(inputCls, "h-9 py-0")} data-portal-handle />
        </label>
        <div>
          <Label>Proof</Label>
          <Shots
            shots={shots}
            onChange={setShots}
            hint={
              platform === "instagram"
                ? "A screenshot of the profile, and of About this account (profile › ⋯ › About this account): it shows when the account joined and where it's based."
                : "A screenshot of the profile showing the handle and followers."
            }
          />
        </div>
        {error && <p className="text-xs text-critical-text">{error}</p>}
        <Button
          variant="primary"
          className="w-full"
          disabled={busy || !handle.trim() || !shots.length}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api("/account", { platform, handle, proofs: shots });
              onDone();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          data-portal-save-account
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Add account
        </Button>
      </div>
    </Sheet>
  );
}
