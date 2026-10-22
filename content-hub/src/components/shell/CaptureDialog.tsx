"use client";

import { X } from "lucide-react";
import { useHub } from "@/lib/store";
import { QuickCapture } from "../QuickCapture";

export function CaptureDialog() {
  const open = useHub((s) => s.captureOpen);
  const setOpen = useHub((s) => s.setCaptureOpen);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[18vh] backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <div
        className="fade-in w-full max-w-lg rounded-xl border border-line-strong bg-surface p-4 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium">Capture an idea</h2>
          <button onClick={() => setOpen(false)} className="rounded-md p-1 text-faint hover:bg-surface-3 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <QuickCapture autoFocus onSaved={() => setTimeout(() => setOpen(false), 400)} />
      </div>
    </div>
  );
}
