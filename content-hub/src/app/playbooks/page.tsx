"use client";

import { useState } from "react";
import { Chip, PageHeader, Panel } from "@/components/ui";
import research from "@/lib/research.json";
import { Sources } from "@/components/Sources";

type Tab = "coaches" | "retention" | "packaging";

export default function PlaybooksPage() {
  const [tab, setTab] = useState<Tab>("coaches");
  return (
    <div>
      <PageHeader
        title="Playbooks"
        subtitle={`What the people who coach content for a living actually teach, boiled down so you can use it. Researched ${research.researchedAt}; click a source to read more.`}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={tab === "coaches"} onClick={() => setTab("coaches")}>
          Coaches & frameworks ({research.coaches.length})
        </Chip>
        <Chip active={tab === "retention"} onClick={() => setTab("retention")}>
          Short-form retention
        </Chip>
        <Chip active={tab === "packaging"} onClick={() => setTab("packaging")}>
          YouTube packaging
        </Chip>
      </div>

      {tab === "coaches" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {research.coaches.map((c) => (
            <Panel key={c.name}>
              <div className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium text-ink">{c.name}</h2>
                  <span className="text-[11px] text-faint">{c.platforms.join(" · ")}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{c.knownFor}</p>
                <div className="mt-4 space-y-3">
                  {c.frameworks.map((f) => (
                    <div key={f.name} className="rounded-xl border border-line bg-surface-2 p-3">
                      <div className="text-sm font-medium text-accent">{f.name}</div>
                      <p className="mt-1 text-sm text-ink/90">{f.summary}</p>
                      <p className="mt-2 text-xs text-muted">
                        <span className="text-faint">For you: </span>
                        {f.howToApply}
                      </p>
                    </div>
                  ))}
                </div>
                <Sources urls={c.sources} />
              </div>
            </Panel>
          ))}
        </div>
      )}

      {(tab === "retention" || tab === "packaging") && (
        <div className="grid gap-3 md:grid-cols-2">
          {(tab === "retention" ? research.retentionPrinciples : research.packagingPrinciples).map((p, i) => (
            <div key={p.principle} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
              <div className="font-mono text-2xl font-semibold text-accent/40">{String(i + 1).padStart(2, "0")}</div>
              <div className="flex-1">
                <div className="font-medium text-ink">{p.principle}</div>
                <p className="mt-1 text-sm text-muted">{p.detail}</p>
                <Sources urls={[p.source]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
