"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { QuickCapture } from "@/components/QuickCapture";
import { Button, Card, PageHeader, Segmented, cx, inputCls, selectCls } from "@/components/ui";
import { PILLARS, PILLAR_STYLE, formatLabel } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { Pillar } from "@/lib/types";

const ANGLES = [
  "From my story bank",
  "Something from the agency this week",
  "Questions people keep asking me",
  "Something everyone gets wrong",
  "What's trending in my space",
  "Mistakes I made",
];

export default function IdeasPage() {
  const items = useHub((s) => s.items);
  const askClaude = useHub((s) => s.askClaude);
  const moveItem = useHub((s) => s.moveItem);
  const openItem = useHub((s) => s.openItem);
  const [pillar, setPillar] = useState<Pillar | "any">("any");
  const [angle, setAngle] = useState(ANGLES[0]);
  const [extra, setExtra] = useState("");

  const ideas = items.filter((i) => i.stage === "idea");

  const generate = () => {
    const p = pillar === "any" ? "spread across all three pillars" : `for the ${pillar} pillar`;
    askClaude(
      `Give me 8 video ideas ${p}, using this angle: ${angle.toLowerCase()}.${extra.trim() ? ` Context: ${extra.trim()}.` : ""} For each: a working title, the format (short, YouTube long form, or text on B-roll), and one hook in my voice.`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Ideas"
        description="Capture everything, then promote the good ones to scripting. When you're blank, generate ideas from your stories and your week."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <div className="p-4">
              <QuickCapture />
            </div>
          </Card>

          {PILLARS.map((p) => {
            const list = ideas.filter((i) => i.pillar === p.id);
            return (
              <section key={p.id}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={cx("size-2 rounded-[3px]", PILLAR_STYLE[p.id].dot)} />
                  <h2 className="text-[13px] font-medium">{p.label}</h2>
                  <span className="text-xs tabular-nums text-faint">{list.length}</span>
                </div>
                {list.length ? (
                  <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                    {list.map((i) => (
                      <li key={i.id} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
                        <button onClick={() => openItem(i.id)} className="min-w-0 flex-1 text-left">
                          <div className="truncate text-[13px] text-ink">{i.title}</div>
                          {i.hooks[i.chosenHook] && <div className="mt-0.5 truncate text-xs text-faint">{i.hooks[i.chosenHook]}</div>}
                        </button>
                        <span className="hidden text-xs text-faint sm:block">{formatLabel(i.format)}</span>
                        <Button size="sm" variant="ghost" onClick={() => moveItem(i.id, "scripting")} className="sm:opacity-0 sm:group-hover:opacity-100">
                          Script it <ArrowRight className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-faint">
                    No {p.label.toLowerCase()} ideas yet.
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <Card title="Idea generator" description="Claude pulls from your stories and voice" className="h-fit lg:sticky lg:top-0">
          <div className="space-y-4 px-4 pb-4 pt-3">
            <div>
              <div className="mb-1.5 text-xs text-faint">Pillar</div>
              <Segmented
                value={pillar}
                onChange={setPillar}
                className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
                options={[{ value: "any", label: "Mix" }, ...PILLARS.map((p) => ({ value: p.id, label: p.label }))]}
              />
            </div>
            <div>
              <div className="mb-1.5 text-xs text-faint">Angle</div>
              <select value={angle} onChange={(e) => setAngle(e.target.value)} className={cx(selectCls, "w-full")}>
                {ANGLES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-xs text-faint">What&apos;s on your mind? (optional)</div>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={3}
                placeholder="We just lost a client, hired two people, ran a campaign that did 5x…"
                className={inputCls}
              />
            </div>
            <Button variant="ai" className="w-full" onClick={generate}>
              <Sparkles className="size-3.5" /> Generate ideas
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
