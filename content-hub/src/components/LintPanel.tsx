"use client";

import { ShieldCheck, TriangleAlert } from "lucide-react";
import { lintScript } from "@/lib/antiAi";

/** Flags anything in a script that would make it sound generated. */
export function LintPanel({ text }: { text: string }) {
  const hits = lintScript(text);
  if (!text.trim()) return null;
  if (!hits.length)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-good/20 bg-good/5 px-3 py-2 text-xs text-good">
        <ShieldCheck className="size-3.5" /> Sounds human. No AI tells found.
      </div>
    );
  return (
    <div className="space-y-1.5 rounded-lg border border-warn/25 bg-warn/5 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-warn">
        <TriangleAlert className="size-3.5" /> {hits.reduce((n, h) => n + h.count, 0)} AI tell
        {hits.length === 1 && hits[0].count === 1 ? "" : "s"} found
      </div>
      <ul className="space-y-1 text-xs text-muted">
        {hits.map((h) => (
          <li key={h.rule.id}>
            <span className="text-ink">{h.samples.join(", ")}</span>
            {h.count > 1 && <span className="text-faint"> ×{h.count}</span>}
            <span className="text-faint"> · {h.rule.why}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
