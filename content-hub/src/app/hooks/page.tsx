"use client";

import { useState } from "react";
import { Check, Copy, FlaskConical, Plus } from "lucide-react";
import { Chip, PageHeader, Panel, cx } from "@/components/ui";
import { PILLARS, PILLAR_STYLE } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { Pillar } from "@/lib/types";
import research from "@/lib/research.json";
import { Sources } from "@/components/Sources";

type Tab = "hooks" | "overlays" | "trials";

export default function HooksPage() {
  const [tab, setTab] = useState<Tab>("hooks");
  const [pillar, setPillar] = useState<Pillar>("business");
  const [copied, setCopied] = useState<string | null>(null);
  const items = useHub((s) => s.items);
  const updateItem = useHub((s) => s.updateItem);
  const [target, setTarget] = useState<string>("");

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1200);
  };

  const addTo = (text: string, field: "hooks" | "overlay") => {
    const item = items.find((i) => i.id === target);
    if (!item) return;
    if (field === "hooks") updateItem(item.id, { hooks: [...item.hooks, text] });
    else updateItem(item.id, { overlay: text });
    setCopied(text);
    setTimeout(() => setCopied(null), 1200);
  };

  const active = items.filter((i) => !["posted", "analysed"].includes(i.stage));

  return (
    <div>
      <PageHeader
        title="Hooks & overlays"
        subtitle={`${research.hookTypes.length} hook types and ${research.overlayPatterns.length} on-screen text patterns, pulled from the people who coach this for a living. Examples are patterns, not facts: swap in your real numbers and details.`}
        actions={
          <label className="flex items-center gap-2 text-xs text-faint">
            Add to card
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="max-w-56 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-ink focus:outline-none"
            >
              <option value="">Pick a card…</option>
              {active.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(
          [
            ["hooks", "Hook types"],
            ["overlays", "Overlay / banner text"],
            ["trials", "Testing with trial reels"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <Chip key={id} active={tab === id} onClick={() => setTab(id)}>
            {label}
          </Chip>
        ))}
        {tab === "hooks" && (
          <>
            <span className="mx-1 h-4 w-px bg-line-strong" />
            {PILLARS.map((p) => (
              <Chip key={p.id} active={pillar === p.id} onClick={() => setPillar(p.id)}>
                {p.label} examples
              </Chip>
            ))}
          </>
        )}
      </div>

      {tab === "hooks" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {research.hookTypes.map((h) => (
            <div key={h.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
              <div className="font-medium text-ink">{h.name}</div>
              <p className="mt-1 text-xs text-muted">{h.whyItWorks}</p>
              <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 font-mono text-[12px] text-accent">
                {h.template}
              </div>
              <ul className="mt-3 flex-1 space-y-1.5">
                {h.examples[pillar].map((ex) => (
                  <li key={ex} className="group flex items-start gap-2 text-sm">
                    <span className={cx("mt-2 size-1.5 shrink-0 rounded-full", PILLAR_STYLE[pillar].dot)} />
                    <span className="flex-1 text-ink/90">{ex}</span>
                    <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <IconBtn onClick={() => copy(ex)} title="Copy">
                        {copied === ex ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </IconBtn>
                      {target && (
                        <IconBtn onClick={() => addTo(ex, "hooks")} title="Add to card's hooks">
                          <Plus className="size-3.5" />
                        </IconBtn>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <Sources urls={h.sources} />
            </div>
          ))}
        </div>
      )}

      {tab === "overlays" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {research.overlayPatterns.map((o) => (
            <div key={o.name} className="group flex flex-col rounded-2xl border border-line bg-surface p-4">
              <div className="text-sm font-medium text-ink">{o.name}</div>
              <div className="mt-2 font-mono text-[12px] text-accent">{o.template}</div>
              {/* A mock phone-safe overlay so you can see how it reads on screen. */}
              <div className="relative mt-3 grid aspect-[16/10] place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-surface-3 via-[#1b1830] to-[#0d0c17] p-4">
                <span className="rounded-md bg-white px-2.5 py-1.5 text-center text-[13px] font-semibold leading-snug text-black shadow-lg">
                  {o.example}
                </span>
              </div>
              <p className="mt-3 flex-1 text-xs text-muted">{o.whenToUse}</p>
              <div className="mt-3 flex gap-1">
                <IconBtn onClick={() => copy(o.example)} title="Copy">
                  {copied === o.example ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </IconBtn>
                {target && (
                  <IconBtn onClick={() => addTo(o.example, "overlay")} title="Use as card's overlay">
                    <Plus className="size-3.5" />
                  </IconBtn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "trials" && (
        <Panel title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-accent" /> How to test hooks with trial reels</span>}>
          <div className="space-y-4 p-5">
            <p className="max-w-3xl text-sm leading-relaxed text-ink/90">{research.trialReels.summary}</p>
            <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
              <div className="mb-2 font-medium text-ink">The hub&apos;s testing routine</div>
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>Pick one card. Keep the video identical.</li>
                <li>Write 2 to 4 overlay or hook variants on the card (Hooks tab).</li>
                <li>Post each as a trial reel in the same posting window.</li>
                <li>After 24 hours, compare trial against trial. Log the winner in the card notes.</li>
                <li>Share the winner to followers. Use that hook type more.</li>
              </ol>
              <p className="mt-3 text-xs text-faint">Logging results automatically comes with Analytics (Phase 4).</p>
            </div>
            <Sources urls={research.trialReels.sources} />
          </div>
        </Panel>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid size-6 place-items-center rounded-md border border-line text-muted hover:border-accent/40 hover:text-ink"
    >
      {children}
    </button>
  );
}
