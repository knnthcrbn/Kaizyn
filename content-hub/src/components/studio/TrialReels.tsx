"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, CloudUpload, FlaskConical, LoaderCircle, TriangleAlert } from "lucide-react";
import { FieldLabel } from "@/components/plan/bits";
import { Button, cx, inputCls, selectCls } from "@/components/ui";
import { addVideos, useLibrary } from "@/lib/footage/library";
import { METRIC_INFO } from "@/lib/insights";
import { atTime, clockLabel, lineUpTrialReels } from "@/lib/plan";
import { dayKey, useHub } from "@/lib/store";
import type { Edit } from "@/lib/studio/types";
import type { PostVideo, TestMetric } from "@/lib/types";

export interface MadeVersion {
  label: string;
  text: string;
  filename: string;
  blob: Blob;
}

const EXPORTS_FOLDER = "Exports";

/**
 * After a versions export: each version goes to Footage (so a phone can get
 * it), and becomes a trial reel on the calendar, all one test of what's on
 * screen. Posting is still done in the app until a posting service is
 * connected; Today hands over each version's video with its caption.
 */
export function TrialReels({ edit, made }: { edit: Edit; made: MadeVersion[] }) {
  const accounts = useHub((s) => s.accounts);
  const card = useHub((s) => s.items.find((i) => i.id === edit.cardId));
  const ig = accounts.filter((a) => a.platform === "instagram" && a.active);
  const [accountId, setAccountId] = useState(ig.find((a) => a.kind === "main")?.id ?? ig[0]?.id ?? "");
  const [day, setDay] = useState(dayKey());
  const [time, setTime] = useState("18:00");
  const [gap, setGap] = useState(20);
  const [caption, setCaption] = useState(card?.caption ?? "");
  const [metric, setMetric] = useState<TestMetric>("views");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ids: string[]; start: number } | null>(null);
  const libItems = useLibrary((s) => s.items);
  const jobs = useLibrary((s) => s.jobs);
  const uploads = (done?.ids ?? []).map((id) => ({ id, ok: !!libItems[id]?.uploaded, failed: libItems[id]?.errors?.upload, pct: jobs[id]?.upload }));

  const lineUp = async () => {
    setSaving(true);
    setError(null);
    try {
      const files = made.map((m) => new File([m.blob], m.filename, { type: m.blob.type }));
      // Studio's exports skip transcription: the footage they came from already has it.
      const ids = await addVideos(files, EXPORTS_FOLDER, { process: false });
      const items = useLibrary.getState().items;
      const start = atTime(day, time);
      lineUpTrialReels({
        cardId: edit.cardId,
        editId: edit.id,
        name: `${card?.title ?? edit.title}: banner`,
        metric,
        versions: made.map((m, i) => {
          const f = items[ids[i]];
          const video: PostVideo | undefined = f ? { footageId: f.id, path: f.file.path, name: f.file.name } : undefined;
          return { label: m.label, text: m.text, video };
        }),
        accountId: accountId || undefined,
        start,
        gapMin: gap,
        caption,
      });
      setDone({ ids, start });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const up = uploads.filter((u) => u.ok).length;
    const failed = uploads.filter((u) => u.failed).length;
    const acc = accounts.find((a) => a.id === accountId);
    const last = done.start + (made.length - 1) * gap * 60_000;
    return (
      <div className="space-y-3 rounded-lg border border-good/30 bg-good/5 p-3" data-trial-done>
        <p className="flex items-start gap-2 text-xs text-ink">
          <Check className="mt-0.5 size-3.5 shrink-0 text-good-text" />
          <span>
            {made.length} trial reels on the calendar for{" "}
            {new Date(done.start).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}, {clockLabel(done.start)} to{" "}
            {clockLabel(last)}
            {acc ? ` from @${acc.handle}` : ""}, as one test.
          </span>
        </p>
        <ul className="space-y-1">
          {made.map((m, i) => {
            const u = uploads[i];
            return (
              <li key={m.label} className="flex items-center gap-2 text-[11px]">
                <span className="grid size-5 shrink-0 place-items-center rounded bg-surface-3 font-semibold text-muted">{m.label}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{m.text}</span>
                <span className={cx("shrink-0 tabular-nums", u?.failed ? "text-critical-text" : u?.ok ? "text-good-text" : "text-faint")} data-trial-upload>
                  {u?.failed ? "Upload failed" : u?.ok ? "In Footage" : u?.pct != null ? `Uploading ${Math.round(u.pct)}%` : "Waiting to upload"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] leading-relaxed text-faint">
          {up < made.length && !failed
            ? "Keep this tab open until they've all uploaded. "
            : failed
              ? "Some didn't upload: save them from the list above and add them to Footage › Exports by hand. "
              : ""}
          On your phone, open Today: each one has its video to save or share straight to Instagram, and its caption. Turn on Trial when you post. Log each
          one&apos;s views after a day or two and the test picks the winner.
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link href="/" className="inline-flex items-center gap-1 text-faint hover:text-ink">
            Today <ArrowUpRight className="size-3" />
          </Link>
          <Link href="/analytics?tab=tests" className="inline-flex items-center gap-1 text-faint hover:text-ink">
            The test <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-line p-3" data-trial-setup>
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-ink">
          <FlaskConical className="size-3.5 text-faint" /> Post them as trial reels
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-faint">
          Instagram shows a trial reel to non-followers first, so your followers never see the same video {made.length} times. Each version goes on the calendar
          a few minutes apart, as one test.
        </p>
      </div>
      {ig.length > 0 ? (
        <label className="block">
          <FieldLabel>Instagram account</FieldLabel>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={cx(selectCls, "w-full")} data-trial-account>
            {ig.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.handle}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-[11px] text-faint">
          No Instagram account added yet, so they&apos;ll be listed as Instagram.{" "}
          <Link href="/accounts" className="text-muted underline-offset-2 hover:underline">
            Add one
          </Link>
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <FieldLabel>Day</FieldLabel>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className={cx(selectCls, "w-full")} />
        </label>
        <label className="block">
          <FieldLabel>First at</FieldLabel>
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={cx(selectCls, "w-full")} data-trial-time />
        </label>
        <label className="block">
          <FieldLabel>Min apart</FieldLabel>
          <input
            type="number"
            min={0}
            value={gap}
            onChange={(e) => setGap(Math.max(0, Number(e.target.value) || 0))}
            className={cx(selectCls, "w-full")}
            data-trial-gap
          />
        </label>
      </div>
      <label className="block">
        <FieldLabel>Caption (the same on every version)</FieldLabel>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          className={cx(inputCls, "resize-none text-xs")}
          placeholder="The caption to post with each one"
          data-trial-caption
        />
      </label>
      <label className="block">
        <FieldLabel>Winner is the one with the most</FieldLabel>
        <select value={metric} onChange={(e) => setMetric(e.target.value as TestMetric)} className={cx(selectCls, "w-full")}>
          {(Object.keys(METRIC_INFO) as TestMetric[]).map((m) => (
            <option key={m} value={m}>
              {METRIC_INFO[m].label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="flex items-start gap-2 text-xs text-critical-text">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
      <Button variant="primary" className="w-full" onClick={lineUp} disabled={saving} data-trial-line-up>
        {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <CloudUpload className="size-3.5" />} Save to Footage and line up {made.length} trial
        reels
      </Button>
    </div>
  );
}
