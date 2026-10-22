"use client";

import { useState } from "react";
import { Sources } from "@/components/Sources";
import { PageHeader, Segmented } from "@/components/ui";
import research from "@/lib/research.json";

type Tab = "coaches" | "retention" | "packaging";

export default function PlaybooksPage() {
  const [tab, setTab] = useState<Tab>("coaches");
  return (
    <div>
      <PageHeader
        title="Playbooks"
        description="What the people who coach content for a living actually teach, boiled down so you can use it."
      />
      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "coaches", label: `Coaches · ${research.coaches.length}` },
            { value: "retention", label: "Short-form retention" },
            { value: "packaging", label: "YouTube packaging" },
          ]}
        />
      </div>

      {tab === "coaches" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {research.coaches.map((c) => (
            <section key={c.name} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-ink">{c.name}</h2>
                <span className="text-[11px] text-faint">{c.platforms.join(" · ")}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-faint">{c.knownFor}</p>
              <div className="mt-4 divide-y divide-line rounded-lg border border-line">
                {c.frameworks.map((f) => (
                  <div key={f.name} className="p-3">
                    <div className="text-[13px] font-medium text-ink">{f.name}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{f.summary}</p>
                    <p className="mt-2 text-xs leading-relaxed text-faint">
                      <span className="font-medium text-muted">Use it: </span>
                      {f.howToApply}
                    </p>
                  </div>
                ))}
              </div>
              <Sources urls={c.sources} />
            </section>
          ))}
        </div>
      )}

      {(tab === "retention" || tab === "packaging") && (
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {(tab === "retention" ? research.retentionPrinciples : research.packagingPrinciples).map((p, i) => (
            <li key={p.principle} className="flex gap-4 p-4">
              <span className="w-6 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-ghost">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink">{p.principle}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{p.detail}</p>
                <Sources urls={[p.source]} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
