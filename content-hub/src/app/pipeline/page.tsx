"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Columns3, List, Plus } from "lucide-react";
import { DueDate } from "@/components/DueDate";
import { ItemCard } from "@/components/ItemCard";
import { Button, PageHeader, PillarTag, Segmented, StageIcon, StageTag, cx, selectCls } from "@/components/ui";
import { FORMATS, PILLARS, PILLAR_STYLE, STAGES, formatLabel, stageIndex } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { ContentItem, Format, Pillar, StageId } from "@/lib/types";

type View = "board" | "list";

export default function PipelinePage() {
  const items = useHub((s) => s.items);
  const moveItem = useHub((s) => s.moveItem);
  const addItem = useHub((s) => s.addItem);
  const openItem = useHub((s) => s.openItem);
  const [view, setView] = useState<View>("board");
  const [pillar, setPillar] = useState<Pillar | "all">("all");
  const [format, setFormat] = useState<Format | "all">("all");
  const [dragging, setDragging] = useState<ContentItem | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const visible = items.filter(
    (i) => (pillar === "all" || i.pillar === pillar) && (format === "all" || i.format === format),
  );

  const newCard = (stage: StageId = "idea") =>
    openItem(addItem({ title: "Untitled", pillar: pillar === "all" ? "business" : pillar, stage }));

  return (
    <div className={cx("flex flex-col", view === "board" && "h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-7rem)]")}>
      <PageHeader
        title="Pipeline"
        description="Every piece of content from idea to analysed. Drag cards between stages, or open one to work on it."
        actions={
          <Button variant="primary" onClick={() => newCard()}>
            <Plus className="size-3.5" /> New card
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: <><Columns3 className="size-3.5" /> Board</> },
            { value: "list", label: <><List className="size-3.5" /> List</> },
          ]}
        />
        <div className="mx-1 h-5 w-px bg-line" />
        <Segmented
          value={pillar}
          onChange={setPillar}
          options={[
            { value: "all", label: "All pillars" },
            ...PILLARS.map((p) => ({
              value: p.id,
              label: (
                <>
                  <span className={cx("size-2 rounded-[3px]", PILLAR_STYLE[p.id].dot)} />
                  {p.label}
                </>
              ),
            })),
          ]}
        />
        <select value={format} onChange={(e) => setFormat(e.target.value as Format | "all")} className={selectCls} aria-label="Format">
          <option value="all">All formats</option>
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-faint">
          {visible.length} card{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {view === "board" ? (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDragging(items.find((i) => i.id === e.active.id) ?? null)}
          onDragCancel={() => setDragging(null)}
          onDragEnd={(e: DragEndEvent) => {
            setDragging(null);
            if (e.over) moveItem(String(e.active.id), e.over.id as StageId);
          }}
        >
          <div className="-mx-4 flex min-h-0 flex-1 gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {STAGES.map((s) => (
              <Column key={s.id} id={s.id} label={s.label} items={visible.filter((i) => i.stage === s.id)} onAdd={() => newCard(s.id)} />
            ))}
          </div>
          <DragOverlay>{dragging && <ItemCard item={dragging} className="shadow-2xl shadow-black/60" />}</DragOverlay>
        </DndContext>
      ) : (
        <ListView items={visible} onOpen={openItem} />
      )}
    </div>
  );
}

function Column({ id, label, items, onAdd }: { id: StageId; label: string; items: ContentItem[]; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cx(
        "flex w-[17rem] shrink-0 flex-col rounded-xl transition-colors",
        isOver ? "bg-surface-2 ring-1 ring-line-strong" : "bg-surface/60",
      )}
    >
      <div className="flex h-10 items-center gap-2 px-3">
        <StageIcon stage={id} />
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-xs tabular-nums text-faint">{items.length}</span>
        <button onClick={onAdd} className="ml-auto rounded-md p-1 text-ghost hover:bg-surface-3 hover:text-ink" title={`New card in ${label}`}>
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-1.5 pb-1.5">
        {items.map((i) => (
          <DraggableCard key={i.id} item={i} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ item }: { item: ContentItem }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: item.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cx(isDragging && "opacity-30")}>
      <ItemCard item={item} />
    </div>
  );
}

function ListView({ items, onOpen }: { items: ContentItem[]; onOpen: (id: string) => void }) {
  const sorted = [...items].sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage) || b.updatedAt - a.updatedAt);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-xs text-faint">
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Pillar</th>
              <th className="px-4 py-2.5 font-medium">Format</th>
              <th className="px-4 py-2.5 font-medium">Due</th>
              <th className="px-4 py-2.5 text-right font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((i) => (
              <tr key={i.id} onClick={() => onOpen(i.id)} className="cursor-pointer transition-colors hover:bg-surface-2">
                <td className="max-w-80 truncate px-4 py-2.5 text-ink">{i.title}</td>
                <td className="px-4 py-2.5">
                  <StageTag stage={i.stage} />
                </td>
                <td className="px-4 py-2.5">
                  <PillarTag pillar={i.pillar} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">{formatLabel(i.format)}</td>
                <td className="px-4 py-2.5">{i.dueDate ? <DueDate date={i.dueDate} /> : <span className="text-xs text-ghost">—</span>}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums text-faint">
                  {new Date(i.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!sorted.length && <div className="px-4 py-10 text-center text-xs text-faint">No cards match these filters.</div>}
    </div>
  );
}
