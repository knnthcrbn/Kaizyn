"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { ItemCard } from "@/components/ItemCard";
import { Button, Chip, PageHeader, cx } from "@/components/ui";
import { FORMATS, PILLARS, STAGES } from "@/lib/meta";
import { useHub } from "@/lib/store";
import type { ContentItem, Format, Pillar, StageId } from "@/lib/types";

export default function PipelinePage() {
  const items = useHub((s) => s.items);
  const moveItem = useHub((s) => s.moveItem);
  const addItem = useHub((s) => s.addItem);
  const openItem = useHub((s) => s.openItem);
  const [pillar, setPillar] = useState<Pillar | "all">("all");
  const [format, setFormat] = useState<Format | "all">("all");
  const [dragging, setDragging] = useState<ContentItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const visible = items.filter(
    (i) => (pillar === "all" || i.pillar === pillar) && (format === "all" || i.format === format),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (e.over) moveItem(String(e.active.id), e.over.id as StageId);
  };

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <PageHeader
        title="Pipeline"
        subtitle="Every piece of content, from idea to analysed. Drag cards between stages; click one to work on it."
        actions={
          <Button variant="primary" onClick={() => openItem(addItem({ title: "New idea", pillar: pillar === "all" ? "business" : pillar }))}>
            <Plus className="size-4" /> New card
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={pillar === "all"} onClick={() => setPillar("all")}>
          All pillars
        </Chip>
        {PILLARS.map((p) => (
          <Chip key={p.id} active={pillar === p.id} onClick={() => setPillar(p.id)}>
            {p.label}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-line-strong" />
        <Chip active={format === "all"} onClick={() => setFormat("all")}>
          All formats
        </Chip>
        {FORMATS.map((f) => (
          <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDragging(items.find((i) => i.id === e.active.id) ?? null)}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        <div className="-mx-4 flex flex-1 gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {STAGES.map((s) => (
            <Column
              key={s.id}
              id={s.id}
              label={s.label}
              hint={s.hint}
              items={visible.filter((i) => i.stage === s.id)}
            />
          ))}
        </div>
        <DragOverlay>{dragging && <ItemCard item={dragging} className="rotate-2 shadow-2xl" />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ id, label, hint, items }: { id: StageId; label: string; hint: string; items: ContentItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cx(
        "flex w-72 shrink-0 flex-col rounded-2xl border bg-surface/70 transition-colors",
        isOver ? "border-accent/50 bg-accent/5" : "border-line",
      )}
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="rounded-full bg-surface-3 px-1.5 text-[11px] tabular-nums text-muted">{items.length}</span>
      </div>
      <div className="px-3 pb-2 text-[11px] text-faint">{hint}</div>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
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
