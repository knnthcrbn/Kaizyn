"use client";

import { CalendarClock, FileText } from "lucide-react";
import { formatLabel } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { ContentItem } from "@/lib/types";
import { cx, PillarBadge } from "./ui";

export function ItemCard({ item, className, compact }: { item: ContentItem; className?: string; compact?: boolean }) {
  const openItem = useHub((s) => s.openItem);
  const hook = item.hooks[item.chosenHook];
  return (
    <button
      onClick={() => openItem(item.id)}
      className={cx(
        "group w-full rounded-xl border border-line bg-surface-2 p-3 text-left transition-all hover:border-accent/30 hover:bg-surface-3 hover:shadow-[0_0_0_1px_rgb(178_177_255/0.08),0_8px_30px_-12px_rgb(178_177_255/0.25)]",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <PillarBadge pillar={item.pillar} />
        <span className="truncate text-[11px] text-faint">{formatLabel(item.format)}</span>
      </div>
      <div className="text-sm font-medium leading-snug text-ink">{item.title}</div>
      {!compact && hook && <div className="mt-1.5 line-clamp-2 text-xs text-muted">“{hook}”</div>}
      {(item.script || item.dueDate) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-faint">
          {item.script && (
            <span className="flex items-center gap-1">
              <FileText className="size-3" /> script
            </span>
          )}
          {item.dueDate && (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3" /> {item.dueDate.slice(5)}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
