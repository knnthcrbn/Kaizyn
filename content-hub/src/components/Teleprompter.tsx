"use client";

import { useEffect, useRef, useState } from "react";
import { FlipHorizontal, Minus, Pause, Play, Plus, X } from "lucide-react";
import { cx } from "./ui";

/**
 * Full-screen scrolling script for recording. Space to play/pause, Esc to close.
 * A recording day passes a heading (which script of how many) and its own
 * buttons (previous, next, recorded) to run a batch back to back.
 */
export function Teleprompter({
  text,
  onClose,
  heading,
  actions,
}: {
  text: string;
  onClose: () => void;
  heading?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40); // pixels per second
  const [size, setSize] = useState(44);
  const [mirror, setMirror] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const el = box.current;
      if (el) el.scrollTop += (speed * (now - last)) / 1000;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowUp") setSpeed((s) => Math.min(200, s + 5));
      if (e.key === "ArrowDown") setSpeed((s) => Math.max(5, s - 5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {heading && <div className="flex items-center justify-center gap-3 border-b border-white/10 px-4 py-2 text-sm text-white/70">{heading}</div>}
      <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 h-px bg-white/30" />
      <div
        ref={box}
        className="flex-1 overflow-y-auto px-[8vw] py-[33vh]"
        style={{ transform: mirror ? "scaleX(-1)" : undefined }}
      >
        <p
          className="mx-auto max-w-4xl whitespace-pre-wrap font-medium leading-[1.35] text-white"
          style={{ fontSize: size }}
        >
          {text || "No script yet."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/80 p-3 text-sm text-white/80">
        <Ctl onClick={() => setPlaying((p) => !p)} active={playing}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pause" : "Play"} <span className="text-white/40">space</span>
        </Ctl>
        <Ctl onClick={() => setSpeed((s) => Math.max(5, s - 5))}>
          <Minus className="size-3.5" />
        </Ctl>
        <span className="w-20 text-center text-xs">speed {speed}</span>
        <Ctl onClick={() => setSpeed((s) => Math.min(200, s + 5))}>
          <Plus className="size-3.5" />
        </Ctl>
        <Ctl onClick={() => setSize((s) => Math.max(24, s - 4))}>A−</Ctl>
        <Ctl onClick={() => setSize((s) => Math.min(96, s + 4))}>A+</Ctl>
        <Ctl onClick={() => setMirror((m) => !m)} active={mirror}>
          <FlipHorizontal className="size-4" /> Mirror
        </Ctl>
        {actions}
        <Ctl onClick={onClose}>
          <X className="size-4" /> Close
        </Ctl>
      </div>
    </div>
  );
}

export function Ctl({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
        active ? "border-white/40 bg-white/15 text-white" : "border-white/15 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}
