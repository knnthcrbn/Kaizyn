"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { ItemCard } from "@/components/ItemCard";
import { QuickCapture } from "@/components/QuickCapture";
import { Button, Chip, PageHeader, Panel, cx, inputCls } from "@/components/ui";
import { PILLARS, PILLAR_STYLE } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { Pillar } from "@/lib/types";

const ANGLES = [
  { id: "story", label: "From my story bank" },
  { id: "agency", label: "Something from the agency this week" },
  { id: "questions", label: "Questions people keep asking me" },
  { id: "contrarian", label: "Something everyone gets wrong" },
  { id: "trend", label: "What's trending in my space" },
  { id: "mistakes", label: "Mistakes I made" },
];

export default function IdeasPage() {
  const items = useHub((s) => s.items);
  const askClaude = useHub((s) => s.askClaude);
  const moveItem = useHub((s) => s.moveItem);
  const [pillar, setPillar] = useState<Pillar | "any">("any");
  const [angle, setAngle] = useState(ANGLES[0].id);
  const [extra, setExtra] = useState("");

  const ideas = items.filter((i) => i.stage === "idea");

  const generate = () => {
    const a = ANGLES.find((x) => x.id === angle)!.label.toLowerCase();
    const p = pillar === "any" ? "spread across all three pillars" : `for the ${pillar} pillar`;
    askClaude(
      `Give me 8 video ideas ${p}, using this angle: ${a}.${extra.trim() ? ` Context: ${extra.trim()}.` : ""} For each: a working title, the format (short, YouTube long form, or text on B-roll), and one hook in my voice.`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Ideas"
        subtitle="Capture everything. Promote the good ones into scripting. When you're blank, let Claude pull ideas from your stories and your week."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <QuickCapture />
          {PILLARS.map((p) => {
            const list = ideas.filter((i) => i.pillar === p.id);
            return (
              <section key={p.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={cx("size-2 rounded-full", PILLAR_STYLE[p.id].dot)} />
                  <h2 className="text-sm font-medium">{p.label}</h2>
                  <span className="text-xs text-faint">{list.length}</span>
                </div>
                {list.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((i) => (
                      <div key={i.id} className="group relative">
                        <ItemCard item={i} />
                        <button
                          onClick={() => moveItem(i.id, "scripting")}
                          className="absolute right-2 top-2 hidden items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-ink group-hover:flex"
                        >
                          Script it <ArrowRight className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-faint">
                    No {p.label.toLowerCase()} ideas yet.
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <Panel title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> Idea generator</span>} className="h-fit lg:sticky lg:top-0">
          <div className="space-y-4 p-4">
            <div>
              <div className="mb-2 text-xs font-medium text-muted">Pillar</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={pillar === "any"} onClick={() => setPillar("any")}>
                  Mix it up
                </Chip>
                {PILLARS.map((p) => (
                  <Chip key={p.id} active={pillar === p.id} onClick={() => setPillar(p.id)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-muted">Angle</div>
              <div className="flex flex-wrap gap-1.5">
                {ANGLES.map((a) => (
                  <Chip key={a.id} active={angle === a.id} onClick={() => setAngle(a.id)}>
                    {a.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-muted">Anything on your mind? (optional)</div>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={3}
                placeholder="e.g. we just lost a client, hired two people, ran a campaign that did 5x…"
                className={inputCls}
              />
            </div>
            <Button variant="primary" className="w-full" onClick={generate}>
              <Sparkles className="size-4" /> Generate ideas
            </Button>
            <p className="text-[11px] text-faint">
              Ideas come back in the Claude panel. Paste the good ones into capture, or open a card and use them there.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
