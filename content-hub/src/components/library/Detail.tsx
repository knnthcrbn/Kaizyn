"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clapperboard,
  Download,
  Eye,
  Link2,
  ListPlus,
  MapPin,
  MessageSquareQuote,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { downloadInPieces, fileUrl } from "@/lib/footage/api";
import {
  allFolders,
  deleteFootage,
  isProcessingHere,
  reprocess,
  stopProcessing,
  updateFootage,
  useLibrary,
} from "@/lib/footage/library";
import { highlight, timecode } from "@/lib/footage/search";
import type { Footage } from "@/lib/footage/types";
import { addClip, createEdit, momentRange, repurposeUrl, studioUrl } from "@/lib/studio/actions";
import { canRepurpose } from "@/lib/studio/shorts";
import { useHub } from "@/lib/store";
import { Button, ConfirmAction, cx, inputCls, selectCls, Tabs } from "../ui";
import { formatBytes, formatDate, statusOf, useThumbs } from "./shared";

export function Detail({ id, at, terms, onClose }: { id: string; at?: number; terms: string[]; onClose: () => void }) {
  const item = useLibrary((s) => s.items[id]);
  const job = useLibrary((s) => s.jobs[id]);
  const savedFolders = useLibrary((s) => s.folders);
  const allItems = useLibrary((s) => s.items);
  const folders = useMemo(() => allFolders({ folders: savedFolders, items: allItems }), [savedFolders, allItems]);
  const thumbs = useThumbs(id, !!item?.shots?.length);
  const video = useRef<HTMLVideoElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"said" | "shown">(item?.transcript?.length ? "said" : "shown");
  const [now, setNow] = useState(at ?? 0);
  const [copied, setCopied] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState<number | null>(null);

  // Open at the moment that was clicked.
  useEffect(() => {
    const v = video.current;
    if (!v || at == null) return;
    const go = () => {
      v.currentTime = Math.max(0, at - 0.5);
    };
    if (v.readyState >= 1) go();
    else v.addEventListener("loadedmetadata", go, { once: true });
  }, [at, id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const seek = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => {});
  };

  const currentLine = useMemo(() => {
    const lines = item?.transcript ?? [];
    let k = -1;
    lines.forEach((l, i) => {
      if (l.start <= now + 0.1) k = i;
    });
    return k;
  }, [item?.transcript, now]);

  // Keep the line being spoken in view.
  useEffect(() => {
    if (tab !== "said" || currentLine < 0) return;
    list.current?.querySelector(`[data-line="${currentLine}"]`)?.scrollIntoView({ block: "nearest" });
  }, [currentLine, tab]);

  if (!item) return null;
  const status = statusOf(item, job);
  const busy = isProcessingHere(id);
  const lower = terms.map((t) => t.toLowerCase());

  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", id);
    url.searchParams.set("t", String(Math.floor(now)));
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:p-4" onClick={onClose}>
      <div
        className="fade-in flex w-full max-w-6xl flex-col overflow-hidden border-line-strong bg-surface shadow-2xl shadow-black/60 sm:rounded-2xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
          <input
            key={item.name}
            defaultValue={item.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== item.name && void updateFootage(id, { name: e.target.value.trim() })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="min-w-0 flex-1 truncate bg-transparent text-[14px] font-medium text-ink focus:outline-none"
            aria-label="Name"
          />
          <span
            className={cx(
              "hidden text-xs sm:inline",
              status.tone === "error" ? "text-critical-text" : status.tone === "ready" ? "text-good-text" : "text-faint",
            )}
          >
            {status.label}
            {status.pct != null && ` ${Math.round(status.pct)}%`}
          </span>
          <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-col lg:w-[58%] lg:border-r lg:border-line">
            <div className="bg-black">
              {item.uploaded ? (
                <video
                  ref={video}
                  src={fileUrl(item.file.path)}
                  controls
                  playsInline
                  preload="metadata"
                  onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
                  className="mx-auto max-h-[52vh] w-full"
                />
              ) : (
                <div className="grid aspect-video place-items-center text-xs text-faint">
                  {item.errors?.upload ? `Upload failed: ${item.errors.upload}` : "Uploading…"}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
              <span className="mr-1 font-mono text-xs text-muted">{timecode(now)}</span>
              <Button size="sm" variant="ghost" onClick={copyLink}>
                {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />} {copied ? "Copied" : "Link to this moment"}
              </Button>
              <AddToCard name={item.name} at={now} />
              {item.uploaded && <AddToEdit item={item} at={now} />}
              {canRepurpose(item) && (
                <Link
                  href={repurposeUrl(item.id)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-brand hover:bg-brand/10"
                  data-library-shorts
                >
                  <Sparkles className="size-3.5" /> Find shorts
                </Link>
              )}
              {item.uploaded && (
                <a
                  href={fileUrl(item.file.path)}
                  download={item.file.name}
                  onClick={async (e) => {
                    if (saving != null) return e.preventDefault();
                    e.preventDefault();
                    try {
                      setSaving(0);
                      const ok = await downloadInPieces(item.file.path, item.file.name, item.file.size, setSaving);
                      // No save dialog in this browser: let the plain link do it.
                      if (!ok) window.location.href = fileUrl(item.file.path);
                    } catch (err) {
                      if ((err as Error).name !== "AbortError") alert((err as Error).message);
                    } finally {
                      setSaving(null);
                    }
                  }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Download className="size-3.5" /> {saving != null ? `Saving ${Math.round(saving)}%` : "Original"}
                </a>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-[13px]">
              <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2">
                <dt className="text-faint">Folder</dt>
                <dd>
                  <select
                    value={item.folder}
                    onChange={(e) => void updateFootage(id, { folder: e.target.value })}
                    className={cx(selectCls, "h-8 w-full max-w-xs")}
                  >
                    <option value="">Top level</option>
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </dd>
                <dt className="text-faint">Filmed</dt>
                <dd className="text-muted">{formatDate(item.recordedAt) || "Unknown"}</dd>
                <dt className="text-faint">Place</dt>
                <dd className="flex items-center gap-1.5 text-muted">
                  {item.location ? (
                    <>
                      <MapPin className="size-3.5 text-faint" />
                      {item.location.place ?? `${item.location.lat.toFixed(4)}, ${item.location.lon.toFixed(4)}`}
                    </>
                  ) : (
                    "No location in the file"
                  )}
                </dd>
                <dt className="text-faint">File</dt>
                <dd className="truncate text-muted">
                  {item.file.name} · {formatBytes(item.file.size)}
                  {item.duration ? ` · ${timecode(item.duration)}` : ""}
                  {item.width ? ` · ${item.width}×${item.height}` : ""}
                </dd>
                <dt className="pt-1 text-faint">Tags</dt>
                <dd className="flex flex-wrap items-center gap-1">
                  {item.tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => void updateFootage(id, { tags: item.tags.filter((x) => x !== t) })}
                      title="Remove"
                      className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-3 px-2 text-xs text-ink hover:bg-critical/15 hover:text-critical-text"
                    >
                      {t} <X className="size-3" />
                    </button>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagDraft.trim()) {
                        void updateFootage(id, { tags: [...new Set([...item.tags, tagDraft.trim().toLowerCase()])] });
                        setTagDraft("");
                      }
                    }}
                    placeholder="Add a tag"
                    className="h-6 w-28 rounded-md bg-transparent px-1 text-base text-ink placeholder:text-ghost focus:outline-none sm:text-xs"
                  />
                </dd>
                <dt className="pt-1 text-faint">Notes</dt>
                <dd>
                  <textarea
                    key={item.notes}
                    defaultValue={item.notes}
                    onBlur={(e) => e.target.value !== (item.notes ?? "") && void updateFootage(id, { notes: e.target.value })}
                    rows={2}
                    placeholder="Anything the team should know about this footage"
                    className={cx(inputCls, "w-full resize-none py-1.5")}
                  />
                </dd>
              </dl>

              {(item.errors?.visuals || item.errors?.transcript) && (
                <div className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical-text">
                  {item.errors.visuals && <p>What&apos;s on screen: {item.errors.visuals}</p>}
                  {item.errors.transcript && <p>Transcript: {item.errors.transcript}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {busy ? (
                  <Button size="sm" onClick={() => stopProcessing(id)}>
                    <Square className="size-3" /> Stop processing
                  </Button>
                ) : (
                  item.uploaded && (
                    <Button size="sm" onClick={() => reprocess(id)} title="Read the stored video again: transcript and what's on screen">
                      <RefreshCw className="size-3.5" /> {status.tone === "ready" ? "Process again" : "Process now"}
                    </Button>
                  )
                )}
                <ConfirmAction
                  question="Delete this video and everything found in it?"
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    await deleteFootage(id);
                    onClose();
                  }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-critical-text hover:bg-critical/10"
                >
                  <Trash2 className="size-3.5" /> Delete
                </ConfirmAction>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-3 pt-1">
              <Tabs
                value={tab}
                onChange={setTab}
                options={[
                  { value: "said", label: `Said${item.transcript ? ` (${item.transcript.length})` : ""}` },
                  { value: "shown", label: `Shown${item.shots ? ` (${item.shots.length})` : ""}` },
                ]}
              />
            </div>
            <div ref={list} className="min-h-0 flex-1 overflow-y-auto">
              {tab === "said" ? (
                item.transcript?.length ? (
                  <ul className="divide-y divide-line">
                    {item.transcript.map((l, i) => {
                      const hit = lower.length > 0 && lower.some((t) => l.text.toLowerCase().includes(t));
                      return (
                        <li key={i} data-line={i}>
                          <button
                            onClick={() => seek(l.start)}
                            className={cx(
                              "flex w-full gap-3 px-4 py-2 text-left text-[13px] leading-relaxed transition-colors hover:bg-surface-2",
                              i === currentLine ? "bg-surface-2 text-ink" : "text-muted",
                              hit && "border-l-2 border-warning",
                            )}
                          >
                            <span className="w-12 shrink-0 pt-px font-mono text-[11px] text-faint">{timecode(l.start)}</span>
                            <span>
                              {highlight(l.text, terms).map((p, k) =>
                                p.hit ? (
                                  <mark key={k} className="rounded bg-warning/25 px-0.5 text-ink">
                                    {p.text}
                                  </mark>
                                ) : (
                                  <span key={k}>{p.text}</span>
                                ),
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty
                    icon={MessageSquareQuote}
                    text={
                      item.steps.transcript === "skipped"
                        ? "This video has no sound."
                        : item.steps.transcript === "running"
                          ? "Transcribing…"
                          : "No transcript yet."
                    }
                  />
                )
              ) : item.shots?.length ? (
                <ul className="grid gap-px bg-line sm:grid-cols-2">
                  {item.shots.map((s, i) => {
                    const hit = lower.length > 0 && lower.some((t) => `${s.description} ${s.tags.join(" ")}`.toLowerCase().includes(t));
                    return (
                      <li key={i} className="bg-surface">
                        <button
                          onClick={() => seek(s.start)}
                          className={cx("flex w-full gap-3 p-3 text-left hover:bg-surface-2", hit && "bg-warning/5")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {thumbs?.[i] ? <img src={thumbs[i]} alt="" className="h-14 w-20 shrink-0 rounded bg-black object-contain" /> : <div className="h-14 w-20 shrink-0 rounded bg-surface-3" />}
                          <span className="min-w-0">
                            <span className="font-mono text-[11px] text-faint">
                              {timecode(s.start)}–{timecode(s.end)}
                            </span>
                            <span className="mt-0.5 line-clamp-3 block text-xs leading-relaxed text-muted">{s.description}</span>
                            {s.onScreenText && <span className="mt-0.5 block truncate text-[11px] text-faint">“{s.onScreenText}”</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty
                  icon={Eye}
                  text={item.steps.visuals === "running" ? "Looking at the footage…" : "Nothing described yet."}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Eye; text: string }) {
  return (
    <div className="grid h-full min-h-40 place-items-center px-6 text-center text-xs text-faint">
      <div>
        <Icon className="mx-auto mb-2 size-5 text-ghost" />
        {text}
      </div>
    </div>
  );
}

/** Notes a clip on a pipeline card, so the editor cutting that video finds it. */
/** Puts the sentence being said at this moment into a Studio edit: a new one (and opens it) or one already going. */
function AddToEdit({ item, at }: { item: Footage; at: number }) {
  const edits = useHub((s) => s.edits);
  const router = useRouter();
  const [done, setDone] = useState<string | null>(null);
  return (
    <label className="relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink">
      {done ? <Check className="size-3.5 text-good-text" /> : <Clapperboard className="size-3.5" />}
      {done ? `Added to ${done}` : "Edit in Studio"}
      <select
        value=""
        onChange={(e) => {
          const range = momentRange(item, at);
          if (e.target.value === "new") {
            const id = createEdit({ title: item.name });
            addClip(id, item, range.from, range.to);
            router.push(studioUrl(id));
            return;
          }
          const edit = edits.find((x) => x.id === e.target.value);
          if (!edit) return;
          addClip(edit.id, item, range.from, range.to);
          setDone(edit.title.length > 24 ? `${edit.title.slice(0, 22)}…` : edit.title);
          setTimeout(() => setDone(null), 2000);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Edit this moment in Studio"
      >
        <option value="">Edit this moment in Studio…</option>
        <option value="new">New edit with this moment</option>
        {edits.length > 0 && (
          <optgroup label="Add to an edit">
            {edits.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title || "Untitled edit"}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}

function AddToCard({ name, at }: { name: string; at: number }) {
  const items = useHub((s) => s.items);
  const updateItem = useHub((s) => s.updateItem);
  const [done, setDone] = useState<string | null>(null);
  const open = items.filter((i) => !["posted", "analysed"].includes(i.stage));
  if (!open.length) return null;
  return (
    <label className="relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink">
      {done ? <Check className="size-3.5 text-good-text" /> : <ListPlus className="size-3.5" />}
      {done ? `Added to ${done}` : "Add to a card"}
      <select
        value=""
        onChange={(e) => {
          const card = items.find((i) => i.id === e.target.value);
          if (!card) return;
          const line = `Clip: ${name} @ ${timecode(at)} (Footage library)`;
          updateItem(card.id, { notes: card.notes ? `${card.notes}\n${line}` : line });
          setDone(card.title.length > 24 ? `${card.title.slice(0, 22)}…` : card.title);
          setTimeout(() => setDone(null), 2000);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Add this moment to a card"
      >
        <option value="">Add this moment to a card…</option>
        {open.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
