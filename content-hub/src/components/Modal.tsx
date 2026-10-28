"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/components/ui";

export function Modal({
  title,
  onClose,
  children,
  className,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[8vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={typeof title === "string" ? title : undefined}
        className={cx("fade-in flex max-h-[84vh] w-full max-w-2xl flex-col rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/60", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-medium text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-faint hover:bg-surface-3 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
