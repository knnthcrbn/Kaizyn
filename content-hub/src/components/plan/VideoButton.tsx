"use client";

import { useRef, useState } from "react";
import { Download, LoaderCircle, Share } from "lucide-react";
import { cx } from "@/components/ui";
import { fileUrl } from "@/lib/footage/api";
import type { PostVideo } from "@/lib/types";

/**
 * A post's own video, handed over for posting in the app. On a phone it opens
 * the share sheet (Save Video, or straight to Instagram); anywhere else it
 * downloads. Safari only shares a file in answer to a tap, so the first tap
 * fetches the video and, if the share sheet won't open after the wait, the
 * second tap opens it.
 */
export function VideoButton({ video, className }: { video: PostVideo; className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const file = useRef<File | null>(null);
  const url = fileUrl(video.path);

  const share = async (f: File) => {
    try {
      await navigator.share({ files: [f], title: video.name });
      return true;
    } catch (e) {
      // Cancelled is fine; "not allowed" means the tap expired while it downloaded.
      return (e as Error).name === "AbortError";
    }
  };

  const onClick = async () => {
    if (file.current) return void share(file.current);
    const phone = window.matchMedia("(pointer: coarse)").matches;
    const probe = new File([], video.name, { type: "video/mp4" });
    if (!phone || !navigator.canShare?.({ files: [probe] })) {
      const a = document.createElement("a");
      a.href = url;
      a.download = video.name;
      a.click();
      return;
    }
    setState("loading");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      file.current = new File([blob], video.name, { type: blob.type || "video/mp4" });
      setState("ready");
      await share(file.current);
    } catch {
      setState("error");
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={state === "loading"}
      className={cx("inline-flex items-center gap-1 text-xs text-faint hover:text-ink disabled:opacity-60", className)}
      title={`${video.name}: save it, or share it straight to Instagram`}
      data-post-video
    >
      {state === "loading" ? <LoaderCircle className="size-3.5 animate-spin" /> : state === "ready" ? <Share className="size-3.5" /> : <Download className="size-3.5" />}
      {state === "loading" ? "Getting it" : state === "ready" ? "Share video" : state === "error" ? "Try again" : "Video"}
    </button>
  );
}
