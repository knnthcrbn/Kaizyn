"use client";

import { useState } from "react";
import { FlaskConical, Plus, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { FieldLabel } from "@/components/plan/bits";
import { Button, cx, inputCls, selectCls } from "@/components/ui";
import { METRIC_INFO } from "@/lib/insights";
import { atTime, planPosts } from "@/lib/plan";
import { dayKey, uid, useHub } from "@/lib/store";
import { withDefaults } from "@/lib/studio/types";
import type { ContentItem, Test, TestMetric, TestVariable } from "@/lib/types";

export const VARIABLES: { id: TestVariable; label: string; hint: string }[] = [
  { id: "overlay", label: "Text on screen", hint: "Same video, a different line on screen. The cheapest test there is." },
  { id: "hook", label: "Spoken hook", hint: "Record a few openings, keep the rest of the video the same." },
  { id: "caption", label: "Caption", hint: "Same video, different caption." },
  { id: "audio", label: "Sound", hint: "Same video, a different trending sound added in the app." },
  { id: "thumbnail", label: "Cover", hint: "Same video, a different cover frame or image." },
  { id: "length", label: "Length", hint: "A tight cut against a longer one." },
  { id: "other", label: "Something else", hint: "Anything you want to compare." },
];

const LABELS = ["A", "B", "C", "D"];

/** Starting versions from the card: its overlay and hooks, or its caption. */
function suggestFor(card: ContentItem | undefined, v: TestVariable) {
  if (!card) return ["", ""];
  const hooks = card.hooks.filter((h) => h.trim());
  const list = v === "overlay" ? [card.overlay, ...hooks] : v === "hook" ? hooks : v === "caption" ? [card.caption] : [];
  const uniq = [...new Set(list.map((x) => x.trim()).filter(Boolean))].slice(0, 3);
  while (uniq.length < 2) uniq.push("");
  return uniq;
}

/** Sets up a trial reel test: two to four versions of one thing, each posted as a trial reel. */
export function TestDialog({ cardId: given, onClose }: { cardId?: string; onClose: () => void }) {
  const items = useHub((s) => s.items);
  const accounts = useHub((s) => s.accounts);
  const [cardId, setCardId] = useState(given ?? "");
  const card = items.find((i) => i.id === cardId);
  const pickable = items.filter((i) => !["posted", "analysed"].includes(i.stage));
  const edit = useHub((s) => (cardId ? s.edits.find((e) => e.cardId === cardId) : undefined));
  const ig = accounts.filter((a) => a.platform === "instagram" && a.active);
  const [variable, setVariable] = useState<TestVariable>("overlay");
  const suggest = (v: TestVariable) => suggestFor(card, v);
  const [values, setValues] = useState<string[]>(() => suggest("overlay"));
  const [name, setName] = useState(card ? `${card.title}: what's on screen` : "");
  const [metric, setMetric] = useState<TestMetric>("views");
  const [accountId, setAccountId] = useState(ig.find((a) => a.kind === "main")?.id ?? ig[0]?.id ?? "");
  const [day, setDay] = useState(dayKey());
  const [time, setTime] = useState("18:00");
  const [gap, setGap] = useState(30);
  const [makeEdits, setMakeEdits] = useState(!!edit);

  const filled = values.map((v) => v.trim()).filter(Boolean);
  const canEdit = !!edit && variable === "overlay";

  const create = () => {
    const hub = useHub.getState();
    const variants: Test["variants"] = filled.map((value, i) => ({ id: uid(), label: LABELS[i], value }));
    const testId = hub.addRecord("tests", {
      cardId: card?.id,
      name: name.trim() || `Test ${new Date().toLocaleDateString()}`,
      variable,
      metric,
      variants,
      learned: "",
      status: "running",
    });
    const start = atTime(day, time);
    const withPosts = variants.map((v, i) => {
      // A version of the edit with this line on screen, so each export is one tap.
      let editId: string | undefined;
      if (canEdit && makeEdits && edit) {
        const e = withDefaults(edit);
        // A copy gets its own id and dates; it isn't the card's edit, so "Open edit" still finds the original.
        editId = hub.addEdit({ ...e, title: `${e.title} · ${v.label}`, cardId: undefined, overlay: { ...e.overlay, text: v.value } });
      }
      const [postId] = planPosts({
        cardId: card?.id,
        targets: [{ platform: "instagram", accountId: accountId || undefined }],
        start: start + i * gap * 60_000,
        gapMin: 0,
        jitterMin: 0,
        captions: [variable === "caption" ? v.value : (card?.caption ?? "")],
        trial: true,
        testId,
        variantId: v.id,
      });
      return { ...v, postId, editId };
    });
    hub.updateRecord("tests", testId, { variants: withPosts });
    onClose();
  };

  return (
    <Modal title="Trial reel test" onClose={onClose} className="max-w-lg">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" data-test-dialog>
        <p className="text-xs leading-relaxed text-faint">
          Post each version as a trial reel: Instagram shows it to non-followers first, so your followers never see the same video twice. After a
          day or two, log each one&apos;s numbers and the winner is clear.
        </p>
        {!given && (
          <label className="block">
            <FieldLabel>Video</FieldLabel>
            <select
              value={cardId}
              onChange={(e) => {
                const next = items.find((i) => i.id === e.target.value);
                setCardId(e.target.value);
                setName(next ? `${next.title}: ${VARIABLES.find((x) => x.id === variable)!.label.toLowerCase()}` : "");
                setValues(suggestFor(next, variable));
              }}
              className={cx(selectCls, "w-full")}
            >
              <option value="">No card</option>
              {pickable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <FieldLabel>Name</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} className={cx(inputCls, "h-8 py-0")} placeholder="What you're finding out" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>What changes</FieldLabel>
            <select
              value={variable}
              onChange={(e) => {
                const v = e.target.value as TestVariable;
                setVariable(v);
                setValues(suggest(v));
                if (card) setName(`${card.title}: ${VARIABLES.find((x) => x.id === v)!.label.toLowerCase()}`);
              }}
              className={cx(selectCls, "w-full")}
            >
              {VARIABLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Winner is the most</FieldLabel>
            <select value={metric} onChange={(e) => setMetric(e.target.value as TestMetric)} className={cx(selectCls, "w-full")}>
              {(Object.keys(METRIC_INFO) as TestMetric[]).map((m) => (
                <option key={m} value={m}>
                  {METRIC_INFO[m].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-2 text-[11px] text-ghost">{VARIABLES.find((v) => v.id === variable)?.hint}</p>

        <div className="space-y-2">
          <FieldLabel>Versions</FieldLabel>
          {values.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-3 text-[11px] font-medium text-muted">{LABELS[i]}</span>
              <input
                value={v}
                onChange={(e) => setValues((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                className={cx(inputCls, "h-8 py-0")}
                placeholder={variable === "overlay" ? "The line on screen" : "Describe this version"}
                data-test-variant
              />
              {values.length > 2 && (
                <button onClick={() => setValues((list) => list.filter((_, j) => j !== i))} className="rounded p-1 text-faint hover:text-ink" aria-label="Remove version">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {values.length < 4 && (
            <button onClick={() => setValues((l) => [...l, ""])} className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink">
              <Plus className="size-3.5" /> Another version
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <FieldLabel>Day</FieldLabel>
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className={cx(selectCls, "w-full")} />
          </label>
          <label className="block">
            <FieldLabel>First at</FieldLabel>
            <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={cx(selectCls, "w-full")} />
          </label>
          <label className="block">
            <FieldLabel>Minutes apart</FieldLabel>
            <input type="number" min={0} value={gap} onChange={(e) => setGap(Math.max(0, Number(e.target.value) || 0))} className={cx(selectCls, "w-full")} />
          </label>
        </div>
        {ig.length > 0 && (
          <label className="block">
            <FieldLabel>Instagram account</FieldLabel>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={cx(selectCls, "w-full")}>
              {ig.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle}
                </option>
              ))}
            </select>
          </label>
        )}
        {canEdit && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={makeEdits} onChange={(e) => setMakeEdits(e.target.checked)} className="accent-white" />
            Make a copy of the Studio edit for each version, with its line on screen
          </label>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={create} disabled={filled.length < 2} data-test-create>
          <FlaskConical className="size-3.5" /> Start test with {filled.length} versions
        </Button>
      </div>
    </Modal>
  );
}
