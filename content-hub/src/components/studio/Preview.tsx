"use client";

import { useEffect, useRef } from "react";
import { fileUrl } from "@/lib/footage/api";
import type { Footage } from "@/lib/footage/types";
import type { CapGroup } from "@/lib/studio/captions";
import { usePlayer } from "@/lib/studio/player";
import { drawFrame, loadFonts } from "@/lib/studio/render";
import { aspectSize, editLength, locate, segLength, type Edit } from "@/lib/studio/types";

// Plays an edit on a canvas, through the same drawFrame the export uses. Each
// source video plays in its own hidden <video>, streamed from the library in
// pieces (Range requests), so a long raw file is never downloaded whole. Cuts
// play as jumps from one piece to the next; music plays in an <audio> kept in
// step with the playhead.

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

  const fontKey = `${edit.captions.style.font}|${edit.overlay.style.font}|${edit.subhead?.text.trim() ? edit.subhead.style.font : ""}`;
  useEffect(() => {
    void loadFonts(latest.current.edit);
  }, [fontKey]);

  const size = aspectSize(edit.aspect);
  const W = Math.round(size.w * PREVIEW_SCALE);
  const H = Math.round(size.h * PREVIEW_SCALE);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pool = new Map<string, HTMLVideoElement>();
    let activeKey: string | null = null;
    let active: HTMLVideoElement | null = null;
    let music: HTMLAudioElement | null = null;
    let musicPath = "";
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
      activeKey = null;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { edit: e, items: lib, groups: caps } = latest.current;
      const total = editLength(e);
      let { t } = usePlayer.getState();
      const { playing, scrubbing } = usePlayer.getState();
      // While the playhead is dragged the picture follows it; playing resumes on release.
      const live = playing && !scrubbing;
      const loc = locate(e, Math.min(t, Math.max(0, total - 1e-3)));

      // Music: follows the playhead while playing.
      if (e.music?.path !== musicPath) {
        music?.pause();
        music = e.music ? new Audio(fileUrl(e.music.path)) : null;
        if (music) music.preload = "auto";
        musicPath = e.music?.path ?? "";
      }
      if (music && e.music) {
        const at = e.music.start + t;
        if (live && at < e.music.duration) {
          if (Math.abs(music.currentTime - at) > 0.25) music.currentTime = at;
          let g = e.music.volume;
          if (e.music.fadeIn) g *= Math.min(1, t / 1.5);
          if (e.music.fadeOut) g *= Math.min(1, Math.max(0, (total - t) / 2.5));
          music.volume = Math.min(1, Math.max(0, g));
          if (music.paused) void music.play().catch(() => {});
        } else if (!music.paused) music.pause();
      }

      if (!loc) {
        if (playing) usePlayer.setState({ playing: false });
        stop();
        drawFrame(ctx, canvas.width, canvas.height, e, undefined, null, caps, t);
        return;
      }
      const seg = loc.seg;
      const segs = loc.segs;
      const v = videoFor(lib[seg.clip.footageId]);
      const key = `${seg.clip.id}:${seg.in}`;

      if (live && v) {
        if (activeKey !== key || active !== v) {
          if (active && active !== v) active.pause();
          active = v;
          activeKey = key;
          v.muted = !!seg.clip.muted;
          v.volume = Math.min(1, Math.max(0, e.sourceVolume ?? 1));
          v.currentTime = loc.source;
          void v.play().catch(() => usePlayer.setState({ playing: false }));
        } else if (!v.seeking && v.readyState >= 2) {
          const here = seg.start + (v.currentTime - seg.in);
          if (Math.abs(here - t) > 0.35) {
            // The playhead was moved while playing.
            v.currentTime = loc.source;
          } else if (v.currentTime >= seg.out - 0.03 || v.ended) {
            // End of this piece: on to the next (across a cut or into the next clip), or stop at the end.
            if (loc.segIndex >= segs.length - 1) {
              t = total;
              usePlayer.setState({ t, playing: false });
              stop();
            } else {
              t = segs[loc.segIndex + 1].start + 1e-3;
              usePlayer.setState({ t });
            }
          } else {
            t = here;
            usePlayer.setState({ t });
            if (v.paused) void v.play().catch(() => {});
          }
          // Have the next piece's video waiting at its first frame.
          const next = segs[loc.segIndex + 1];
          if (next && seg.out - v.currentTime < 1.5) {
            const nv = videoFor(lib[next.clip.footageId]);
            if (nv && nv !== v && !nv.seeking && Math.abs(nv.currentTime - next.in) > 0.1) nv.currentTime = next.in;
          }
        }
      } else {
        if (live && !v) {
          // Nothing to play for this piece (its footage is missing): skip past it.
          const next = segs[loc.segIndex + 1];
          usePlayer.setState(next ? { t: next.start + 1e-3 } : { t: total, playing: false });
        }
        if (active) stop();
        if (v && !v.seeking && Math.abs(v.currentTime - loc.source) > 0.04) v.currentTime = loc.source;
      }

      const ready = v && v.readyState >= 2 && v.videoWidth > 0;
      const source = seg.in + Math.min(Math.max(0, t - seg.start), segLength(seg));
      drawFrame(
        ctx,
        canvas.width,
        canvas.height,
        e,
        seg.clip,
        ready ? { image: v, width: v.videoWidth, height: v.videoHeight } : null,
        caps,
        t,
        source,
      );
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      music?.pause();
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
