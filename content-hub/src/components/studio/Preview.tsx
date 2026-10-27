"use client";

import { useEffect, useRef } from "react";
import { fileUrl } from "@/lib/footage/api";
import type { Footage } from "@/lib/footage/types";
import type { CapGroup } from "@/lib/studio/captions";
import { usePlayer } from "@/lib/studio/player";
import { drawFrame, loadFonts } from "@/lib/studio/render";
import { aspectSize, clipLength, clipStarts, editLength, locate, type Edit } from "@/lib/studio/types";

// Plays an edit on a canvas, through the same drawFrame the export uses. Each
// source video plays in its own hidden <video>, streamed from the library in
// pieces (Range requests), so a long raw file is never downloaded whole.

const POOL = 4; // videos kept ready at once
const PREVIEW_SCALE = 1 / 3; // a 1080x1920 edit previews at 360x640

export function Preview({
  edit,
  items,
  groups,
  className,
}: {
  edit: Edit;
  items: Record<string, Footage>;
  groups: CapGroup[];
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ edit, items, groups });
  useEffect(() => {
    latest.current = { edit, items, groups };
  });

  const size = aspectSize(edit.aspect);
  const W = Math.round(size.w * PREVIEW_SCALE);
  const H = Math.round(size.h * PREVIEW_SCALE);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    void loadFonts();

    const pool = new Map<string, HTMLVideoElement>();
    let activeClip: string | null = null;
    let active: HTMLVideoElement | null = null;
    let raf = 0;

    const videoFor = (f: Footage | undefined) => {
      if (!f?.uploaded) return null;
      let v = pool.get(f.id);
      if (v) {
        // Most recently used goes last.
        pool.delete(f.id);
        pool.set(f.id, v);
        return v;
      }
      v = document.createElement("video");
      v.preload = "auto";
      v.playsInline = true;
      v.src = fileUrl(f.file.path);
      pool.set(f.id, v);
      while (pool.size > POOL) {
        const [oldId, old] = pool.entries().next().value!;
        if (old === active) break;
        old.pause();
        old.removeAttribute("src");
        old.load();
        pool.delete(oldId);
      }
      return v;
    };

    const stop = () => {
      active?.pause();
      active = null;
      activeClip = null;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { edit: e, items: lib, groups: caps } = latest.current;
      const total = editLength(e);
      let { t, playing } = usePlayer.getState();
      const loc = e.clips.length ? locate(e, Math.min(t, Math.max(0, total - 1e-3))) : null;
      if (!loc) {
        if (playing) usePlayer.setState({ playing: false });
        stop();
        drawFrame(ctx, canvas.width, canvas.height, e, undefined, null, caps, t);
        return;
      }
      const v = videoFor(lib[loc.clip.footageId]);

      if (playing && v) {
        if (activeClip !== loc.clip.id || active !== v) {
          if (active && active !== v) active.pause();
          active = v;
          activeClip = loc.clip.id;
          v.muted = !!loc.clip.muted;
          v.currentTime = loc.source;
          void v.play().catch(() => usePlayer.setState({ playing: false }));
        } else if (!v.seeking && v.readyState >= 2) {
          const here = loc.start + (v.currentTime - loc.clip.in);
          if (Math.abs(here - t) > 0.35) {
            // The playhead was moved while playing.
            v.currentTime = loc.source;
          } else if (v.currentTime >= loc.clip.out - 0.03 || v.ended) {
            // End of this clip: on to the next, or stop at the end.
            const next = clipStarts(e)[loc.index] + clipLength(loc.clip);
            if (loc.index >= e.clips.length - 1) {
              t = total;
              playing = false;
              usePlayer.setState({ t, playing });
              stop();
            } else {
              t = next + 1e-3;
              usePlayer.setState({ t });
            }
          } else {
            t = here;
            usePlayer.setState({ t });
            if (v.paused) void v.play().catch(() => {});
          }
          // Have the next clip's video waiting at its first frame.
          const nextClip = e.clips[loc.index + 1];
          if (nextClip && loc.clip.out - v.currentTime < 1.5) {
            const nv = videoFor(lib[nextClip.footageId]);
            if (nv && nv !== v && !nv.seeking && Math.abs(nv.currentTime - nextClip.in) > 0.1) nv.currentTime = nextClip.in;
          }
        }
      } else {
        if (playing && !v) {
          // Nothing to play for this clip (its footage is missing): skip past it.
          const next = clipStarts(e)[loc.index] + clipLength(loc.clip);
          usePlayer.setState(loc.index >= e.clips.length - 1 ? { t: total, playing: false } : { t: next + 1e-3 });
        }
        if (active) stop();
        if (v && !v.seeking && Math.abs(v.currentTime - loc.source) > 0.04) v.currentTime = loc.source;
      }

      const ready = v && v.readyState >= 2 && v.videoWidth > 0;
      drawFrame(
        ctx,
        canvas.width,
        canvas.height,
        e,
        loc.clip,
        ready ? { image: v, width: v.videoWidth, height: v.videoHeight } : null,
        caps,
        t,
      );
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      for (const v of pool.values()) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
      pool.clear();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      data-studio-preview
      className={className}
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
    />
  );
}
