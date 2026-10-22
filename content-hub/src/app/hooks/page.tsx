"use client";

import { useState } from "react";
import { Check, Copy, FlaskConical, Plus } from "lucide-react";
import { Sources } from "@/components/Sources";
import { Card, PageHeader, Segmented, cx, selectCls } from "@/components/ui";
import { PILLARS, PILLAR_STYLE } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { Pillar } from "@/lib/types";
import research from "@/lib/research.json";

type Tab = "hooks" | "overlays" | "trials";

export default function HooksPage() {
  const [tab, setTab] = useState<Tab>("hooks");
  const [pillar, setPillar] = useState<Pillar>("business");
  const [flash, setFlash] = useState<string | null>(null);
  const items = useHub((s) => s.items);
  const updateItem = useHub((s) => s.updateItem);
  const [target, setTarget] = useState("");

  const done = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 1200);
  };
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    done(text);
  };
  const addTo = (text: string, field: "hooks" | "overlay") => {
    const item = items.find((i) => i.id === target);
    if (!item) return;
    updateItem(item.id, field === "hooks" ? { hooks: [...item.hooks, text] } : { overlay: text });
    done(text);
  };

  const active = items.filter((i) => !["posted", "analysed"].includes(i.stage));

  return (
    <div>
      <PageHeader
        title="Hooks & overlays"
        description="Proven hook types and on-screen text patterns, pulled from the people who coach this. Examples show the pattern; swap in your real numbers and details."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "hooks", label: `Hook types · ${research.hookTypes.length}` },
            { value: "overlays", label: `Overlays · ${research.overlayPatterns.length}` },
            { value: "trials", label: "Trial reel testing" },
          ]}
        />
        {tab === "hooks" && (
          <Segmented
            value={pillar}
            onChange={setPillar}
            options={PILLARS.map((p) => ({
              value: p.id,
              label: (
                <>
                  <span className={cx("size-2 rounded-[3px]", PILLAR_STYLE[p.id].dot)} />
                  {p.label}
                </>
              ),
            }))}
          />
        )}
        {tab !== "trials" && (
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={cx(selectCls, "ml-auto max-w-60")}>
            <option value="">Add to a card…</option>
            {active.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "hooks" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {research.hookTypes.map((h) => (
            <div key={h.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
              <div className="text-[13px] font-medium text-ink">{h.name}</div>
              <p className="mt-1 text-xs leading-relaxed text-faint">{h.whyItWorks}</p>
              <div className="mt-3 rounded-md bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">{h.template}</div>
              <ul className="mt-3 flex-1 space-y-2">
                {h.examples[pillar].map((ex) => (
                  <li key={ex} className="group flex items-start gap-2">
                    <span className="flex-1 text-[13px] leading-relaxed text-ink/90">“{ex}”</span>
                    <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <IconBtn onClick={() => copy(ex)} title="Copy">
                        {flash === ex ? <Check className="size-3.5 text-good-text" /> : <Copy className="size-3.5" />}
                      </IconBtn>
                      {target && (
                        <IconBtn onClick={() => addTo(ex, "hooks")} title="Add to the card's hooks">
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {research.overlayPatterns.map((o) => (
            <div key={o.name} className="group flex flex-col rounded-xl border border-line bg-surface p-4">
              {/* How it reads on screen. */}
              <div className="grid aspect-[16/10] place-items-center rounded-lg bg-[radial-gradient(120%_90%_at_30%_20%,#3a3a40_0%,#1b1b1f_55%,#0f0f11_100%)] p-4">
                <span className="rounded bg-white px-2.5 py-1.5 text-center text-[13px] font-semibold leading-snug text-black shadow-lg">
                  {o.example}
                </span>
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="text-[13px] font-medium text-ink">{o.name}</div>
                <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <IconBtn onClick={() => copy(o.example)} title="Copy">
                    {flash === o.example ? <Check className="size-3.5 text-good-text" /> : <Copy className="size-3.5" />}
                  </IconBtn>
                  {target && (
                    <IconBtn onClick={() => addTo(o.example, "overlay")} title="Use as the card's overlay">
                      <Plus className="size-3.5" />
                    </IconBtn>
                  )}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-faint">{o.template}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{o.whenToUse}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "trials" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <Card title="What trial reels are">
            <div className="px-4 pb-4 pt-2">
              <p className="text-[13px] leading-relaxed text-muted">{research.trialReels.summary}</p>
              <Sources urls={research.trialReels.sources} />
            </div>
          </Card>
          <Card title={<span className="flex items-center gap-2"><FlaskConical className="size-3.5 text-muted" /> The testing routine</span>} className="h-fit">
            <ol className="space-y-3 px-4 pb-4 pt-3">
              {[
                "Pick one card. Keep the video identical.",
                "Write 2 to 4 hook or overlay variants on the card.",
                "Post each as a trial reel in the same posting window.",
                "After 24 hours, compare trial against trial. Note the winner on the card.",
                "Share the winner to followers. Use that hook type more.",
              ].map((s, i) => (
                <li key={s} className="flex gap-3 text-[13px] text-muted">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-medium tabular-nums text-ink">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="border-t border-line px-4 py-3 text-[11px] text-ghost">Automatic results logging comes with Analytics.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="grid size-6 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink">
      {children}
    </button>
  );
}
