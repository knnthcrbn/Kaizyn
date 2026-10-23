"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { loadThumbs, type Job } from "@/lib/footage/library";
import type { Footage, FootageThumbs } from "@/lib/footage/types";
import { cx } from "../ui";

export function useThumbs(id: string | undefined, enabled = true) {
  const [thumbs, setThumbs] = useState<FootageThumbs | null>(null);
  useEffect(() => {
    if (!id || !enabled) return;
    let live = true;
    loadThumbs(id)
      .then((t) => live && setThumbs(t))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, enabled]);
  return thumbs;
}

/** The shot thumbnail nearest a moment, or the poster while thumbnails load. */
export function MomentThumb({ item, at, shot, className }: { item: Footage; at: number; shot?: number; className?: string }) {
  const thumbs = useThumbs(item.id);
  let src = item.poster;
  if (thumbs && item.shots?.length) {
    let i = shot;
    if (i == null) {
      i = 0;
      item.shots.forEach((s, k) => {
        if (s.start <= at) i = k;
      });
    }
    src = thumbs[i] ?? src;
  }
  return <Poster src={src} className={className} />;
}

export function Poster({ src, className }: { src?: string; className?: string }) {
  return (
    <div className={cx("relative grid shrink-0 place-items-center overflow-hidden bg-black", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : (
        <Film className="size-5 text-ghost" />
      )}
    </div>
  );
}

export function formatBytes(n: number) {
  if (n < 1024 ** 2) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export const formatDate = (t?: number) =>
  t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

/** What a video is doing right now, in a few words, with a 0-100 progress. */
export function statusOf(item: Footage, job?: Job): { label: string; pct?: number; tone: "busy" | "error" | "ready" | "idle" } {
  if (job && job.stage !== "done" && job.stage !== "error") {
    if (job.stage === "queued") return { label: "Waiting", tone: "busy" };
    if (job.stage === "reading") return { label: "Reading file", tone: "busy" };
    if (job.model != null && job.model < 100) return { label: "Getting speech model", pct: job.model, tone: "busy" };
    if (job.stage === "uploading" && (job.upload ?? 0) < 100 && job.visuals == null)
      return { label: "Uploading", pct: job.upload, tone: "busy" };
    const parts = [job.upload != null && job.upload < 100 ? job.upload : null, job.visuals, job.transcript].filter(
      (x): x is number => x != null,
    );
    const pct = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : undefined;
    return { label: "Processing", pct, tone: "busy" };
  }
  const errs = item.errors ?? {};
  if (errs.upload) return { label: "Upload failed", tone: "error" };
  if (errs.visuals || errs.transcript) return { label: "Needs a retry", tone: "error" };
  const { transcript, visuals } = item.steps;
  if ((transcript === "done" || transcript === "skipped") && (visuals === "done" || visuals === "skipped"))
    return { label: "Searchable", tone: "ready" };
  if (!item.uploaded) return { label: "Not uploaded", tone: "error" };
  if (transcript === "running" || visuals === "running") return { label: "Processing elsewhere or stopped", tone: "idle" };
  return { label: "Not processed", tone: "idle" };
}
