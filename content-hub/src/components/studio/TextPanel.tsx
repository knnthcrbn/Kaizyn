"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Segmented, cx, inputCls, selectCls } from "@/components/ui";
import type { Edit } from "@/lib/studio/types";
import { useHub } from "@/lib/store";

const UNTIL = [
  { value: "0", label: "Whole video" },
  { value: "3", label: "First 3s" },
  { value: "5", label: "First 5s" },
];

export function TextPanel({ edit }: { edit: Edit }) {
  const cards = useHub((s) => s.items);
  const card = edit.cardId ? cards.find((c) => c.id === edit.cardId) : undefined;
  const open = cards.filter((c) => !["posted", "analysed"].includes(c.stage) || c.id === edit.cardId);
  const update = (patch: Partial<Edit>) => useHub.getState().updateEdit(edit.id, patch);
  const setOverlay = (patch: Partial<Edit["overlay"]>) =>
    useHub.getState().updateEdit(edit.id, (e) => ({ overlay: { ...e.overlay, ...patch } }));
  // Lines worth one tap: the card's overlay and its hooks.
  const options = card ? [...new Set([card.overlay, ...card.hooks].map((x) => x?.trim()).filter(Boolean))] : [];

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">For card</div>
        <select
          value={edit.cardId ?? ""}
          onChange={(e) => {
            const next = cards.find((c) => c.id === e.target.value);
            update({
              cardId: next?.id,
              // An untitled edit takes the card's name.
              ...(next && (!edit.title || edit.title === "Untitled edit") ? { title: next.title } : {}),
            });
          }}
          className={cx(selectCls, "w-full")}
        >
          <option value="">No card</option>
          {open.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </section>

      <section>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">Text on screen</div>
        <textarea
          value={edit.overlay.text}
          onChange={(e) => setOverlay({ text: e.target.value })}
          rows={3}
          placeholder="The hook, e.g. 'Go broad' is why your CPA doubled"
          className={cx(inputCls, "resize-none")}
        />
        {options.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-[11px] text-ghost">From the card</div>
            {options.map((o) => (
              <button
                key={o}
                onClick={() => setOverlay({ text: o })}
                className={cx(
                  "block w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                  edit.overlay.text === o ? "border-line-strong bg-surface-2 text-ink" : "border-line text-muted hover:text-ink",
                )}
              >
                {o}
              </button>
            ))}
          </div>
        )}
        <Link href="/hooks" className="mt-2 inline-flex items-center gap-1 text-[11px] text-faint hover:text-ink">
          Browse hook and overlay patterns <ArrowUpRight className="size-3" />
        </Link>
      </section>

      {edit.overlay.text.trim() && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs text-muted">Shows for</span>
            <Segmented value={String(edit.overlay.until)} onChange={(v) => setOverlay({ until: Number(v) })} options={UNTIL} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs text-muted">Position</span>
            <Segmented
              value={edit.overlay.position}
              onChange={(position) => setOverlay({ position })}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
              ]}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-ghost">
            For trial reels: export once, change the text, export again. Same video, different hook.
          </p>
        </section>
      )}
    </div>
  );
}
