"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, AudioLines, Check, Copy, ExternalLink, FlaskConical, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { VideoButton } from "./VideoButton";
import { Button, ConfirmAction, Segmented, cx, inputCls, selectCls } from "@/components/ui";
import { studioUrl } from "@/lib/studio/actions";
import { atTime, dayOf, logResults, markPosted, postTitle, timeOf } from "@/lib/plan";
import { useHub } from "@/lib/store";
import type { Platform, Post, PostResults } from "@/lib/types";
import { FieldLabel, NumberField, PlatformChips } from "./bits";

type Draft = Omit<PostResults, "at">;

const FIELDS: { key: keyof Draft; label: string; suffix?: string; max?: number }[] = [
  { key: "views", label: "Views" },
  { key: "avgWatch", label: "Avg watched", suffix: "%", max: 100 },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "follows", label: "Follows" },
];

/** One post: when and where it goes, its caption, going live, and its numbers. */
export function PostDialog({ postId, onClose, focus }: { postId: string; onClose: () => void; focus?: "results" }) {
  const post = useHub((s) => s.posts.find((p) => p.id === postId));
  if (!post) return null;
  return <Body key={post.id} post={post} onClose={onClose} focus={focus} />;
}

function Body({ post, onClose, focus }: { post: Post; onClose: () => void; focus?: "results" }) {
  const items = useHub((s) => s.items);
  const accounts = useHub((s) => s.accounts);
  const sounds = useHub((s) => s.sounds);
  const tests = useHub((s) => s.tests);
  const edit = useHub((s) => (post.cardId ? s.edits.find((e) => e.cardId === post.cardId) : undefined));
  const update = (patch: Partial<Post>) => useHub.getState().updateRecord("posts", post.id, patch);
  const [url, setUrl] = useState(post.url ?? "");
  const [draft, setDraft] = useState<Draft>(() => {
    const r: Partial<PostResults> = { ...post.results };
    delete r.at;
    return r;
  });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const card = post.cardId ? items.find((i) => i.id === post.cardId) : undefined;
  const account = accounts.find((a) => a.id === post.accountId);
  const sound = sounds.find((x) => x.id === post.soundId);
  const test = tests.find((t) => t.id === post.testId);
  const variant = test?.variants.find((v) => v.id === post.variantId);
  const onPlatform = accounts.filter((a) => a.platform === post.platform);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(post.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Modal title={postTitle(post, items)} onClose={onClose} className="max-w-xl">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4" data-post-dialog>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={post.status}
            onChange={(status) => (status === "posted" ? markPosted(post.id) : update({ status }))}
            options={[
              { value: "planned", label: "Planned" },
              { value: "posted", label: "Posted" },
              { value: "skipped", label: "Skipped" },
            ]}
          />
          {card && (
            <button onClick={() => (onClose(), useHub.getState().openItem(card.id))} className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink">
              Open card <ArrowUpRight className="size-3" />
            </button>
          )}
          {edit && (
            <Link href={studioUrl(edit.id)} className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink">
              Video in Studio <ArrowUpRight className="size-3" />
            </Link>
          )}
        </div>

        {test && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <FlaskConical className="size-3.5 text-faint" /> Test &ldquo;{test.name}&rdquo;{variant ? `, version ${variant.label}` : ""}
          </p>
        )}

        {post.video && (
          <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5" data-post-video-row>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ink">{test?.variable === "overlay" && variant ? variant.value : post.video.name}</span>
              <span className="block text-[11px] text-faint">
                {post.trial ? "Post this file as a trial reel: turn on Trial before you share it." : "Post this exact file."}
              </span>
            </span>
            <VideoButton video={post.video} className="shrink-0 font-medium text-ink" />
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel>Where</FieldLabel>
            <PlatformChips value={[post.platform]} onChange={([platform]) => update({ platform: platform as Platform, accountId: undefined })} />
          </div>
          <label className="block">
            <FieldLabel>Account</FieldLabel>
            <select value={post.accountId ?? ""} onChange={(e) => update({ accountId: e.target.value || undefined })} className={cx(selectCls, "w-full")}>
              <option value="">{onPlatform.length ? "No particular account" : "No accounts added yet"}</option>
              {onPlatform.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle}
                  {a.kind === "clipping" ? ` · ${a.group || "clipping"}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="block">
              <FieldLabel>Day</FieldLabel>
              <input type="date" value={dayOf(post.at)} onChange={(e) => e.target.value && update({ at: atTime(e.target.value, timeOf(post.at)) })} className={cx(selectCls, "w-full")} />
            </label>
            <label className="block">
              <FieldLabel>Time</FieldLabel>
              <input type="time" value={timeOf(post.at)} onChange={(e) => e.target.value && update({ at: atTime(dayOf(post.at), e.target.value) })} className={selectCls} />
            </label>
          </div>
          {post.platform === "instagram" && (
            <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
              <input type="checkbox" checked={!!post.trial} onChange={(e) => update({ trial: e.target.checked || undefined })} className="accent-white" />
              Post as a trial reel (shown to non-followers first)
            </label>
          )}
        </section>

        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel className="mb-0">Caption</FieldLabel>
            <button onClick={copy} className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink" data-post-copy>
              {copied ? <Check className="size-3.5 text-good-text" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea value={post.caption} onChange={(e) => update({ caption: e.target.value })} rows={4} className={cx(inputCls, "resize-y")} />
        </section>

        <section>
          <FieldLabel>Sound</FieldLabel>
          <select value={post.soundId ?? ""} onChange={(e) => update({ soundId: e.target.value || undefined })} className={cx(selectCls, "w-full")}>
            <option value="">The video&apos;s own audio</option>
            {sounds
              .filter((x) => x.status !== "faded" || x.id === post.soundId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.artist ? ` · ${x.artist}` : ""}
                </option>
              ))}
          </select>
          {sound && post.status === "planned" && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
              <AudioLines className="mt-0.5 size-3 shrink-0" />
              Add &ldquo;{sound.name}&rdquo; in the app when you post. The platforms don&apos;t let other apps attach their music.
              {sound.url && (
                <a href={sound.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  Open the sound
                </a>
              )}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <FieldLabel>Live post</FieldLabel>
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link to the post, once it's up" className={cx(inputCls, "h-8 py-0")} />
            {post.url && (
              <a href={post.url} target="_blank" rel="noreferrer" className="grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong text-faint hover:text-ink" aria-label="Open post">
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          {post.status !== "posted" ? (
            <Button variant="primary" className="w-full" onClick={() => markPosted(post.id, url.trim() || undefined)} data-post-mark>
              <Check className="size-3.5" /> Mark posted{account ? ` on @${account.handle}` : ""}
            </Button>
          ) : (
            url.trim() !== (post.url ?? "") && (
              <Button size="sm" onClick={() => update({ url: url.trim() || undefined })}>
                Save link
              </Button>
            )
          )}
        </section>

        {post.status === "posted" && (
          <section data-post-results>
            <FieldLabel>Results</FieldLabel>
            <p className="mb-2 text-[11px] leading-relaxed text-ghost">
              From the app&apos;s insights, ideally about 48 hours after posting so posts compare fairly. &ldquo;12.4k&rdquo; works.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FIELDS.map((f) => (
                <NumberField key={f.key} label={f.label} suffix={f.suffix} max={f.max} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant={focus === "results" ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  logResults(post.id, draft);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                }}
                data-post-save-results
              >
                {saved ? <Check className="size-3.5" /> : null} {saved ? "Saved" : "Save results"}
              </Button>
              {post.results && <span className="text-[11px] text-ghost">Last read {new Date(post.results.at).toLocaleDateString()}</span>}
            </div>
          </section>
        )}

        <section>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={post.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} rows={2} className={cx(inputCls, "resize-y")} placeholder="Anything to remember about this one" />
        </section>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <ConfirmAction
          question="Delete this post?"
          onConfirm={() => {
            useHub.getState().deleteRecord("posts", post.id);
            onClose();
          }}
          className="inline-flex items-center gap-1 text-xs text-faint hover:text-critical-text"
        >
          <Trash2 className="size-3.5" /> Delete
        </ConfirmAction>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
