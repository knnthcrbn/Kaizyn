"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { lintScript } from "@/lib/antiAi";

/** Flags anything in a script that would make it sound generated. */
export function LintPanel({ text }: { text: string }) {
  const hits = lintScript(text);
  if (!text.trim()) return null;
  if (!hits.length)
    return (
      <div className="flex items-center gap-2 text-xs text-good-text">
        <CircleCheck className="size-3.5" /> Sounds human. No AI tells found.
      </div>
    );
  const total = hits.reduce((n, h) => n + h.count, 0);
  return (
    <div className="rounded-lg border border-warning/20 bg-warning/[0.04] p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-warning">
        <TriangleAlert className="size-3.5" /> {total} AI tell{total === 1 ? "" : "s"} found
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {hits.map((h) => (
          <li key={h.rule.id} className="text-muted">
            <span className="text-ink">{h.samples.join(", ")}</span>
            {h.count > 1 && <span className="text-faint"> ×{h.count}</span>}
            <span className="text-faint"> · {h.rule.why}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
