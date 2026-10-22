"use client";

import { CalendarClock, FileText } from "lucide-react";
import { formatLabel } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { ContentItem } from "@/lib/types";
import { cx, PillarTag } from "./ui";
import { DueDate } from "./DueDate";

export function ItemCard({ item, className }: { item: ContentItem; className?: string }) {
  const openItem = useHub((s) => s.openItem);
  const hook = item.hooks[item.chosenHook];
  return (
    <button
      onClick={() => openItem(item.id)}
      className={cx(
        "group w-full rounded-lg border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-3",
        className,
      )}
    >
      <div className="text-[13px] font-medium leading-snug text-ink">{item.title}</div>
      {hook && <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-faint">{hook}</div>}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <PillarTag pillar={item.pillar} />
        <span className="text-xs text-faint">{formatLabel(item.format)}</span>
        {item.script && (
          <span className="flex items-center gap-1 text-xs text-faint" title="Has a script">
            <FileText className="size-3" />
          </span>
        )}
        {item.dueDate && (
          <span className="ml-auto flex items-center gap-1">
            <CalendarClock className="size-3 text-faint" />
            <DueDate date={item.dueDate} />
          </span>
        )}
      </div>
    </button>
  );
}
