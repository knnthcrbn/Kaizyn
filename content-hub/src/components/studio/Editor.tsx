"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Pause, Play, TriangleAlert } from "lucide-react";
import { MomentThumb } from "@/components/library/shared";
import { Button, Kbd, Segmented, Tabs, cx } from "@/components/ui";
import { useLibrary } from "@/lib/footage/library";
import type { Footage } from "@/lib/footage/types";
import { buildCaptions } from "@/lib/studio/captions";
import { seek, setPlaying, togglePlaying, usePlayer } from "@/lib/studio/player";
import { ASPECTS, aspectSize, clipLength, editLength, type Edit } from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import { useSync } from "@/lib/sync";
import { CaptionPanel } from "./CaptionPanel";
import { ClipPanel } from "./ClipPanel";
import { ClipPicker } from "./ClipPicker";
import { ExportDialog } from "./ExportDialog";
import { precise } from "./format";
import { Preview } from "./Preview";
import { TextPanel } from "./TextPanel";

type Tab = "clips" | "captions" | "text";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));


export function Editor({ id, onClose }: { id: string; onClose: () => void }) {
  const edit = useHub((s) => s.edits.find((e) => e.id === id));
  const syncing = useSync((s) => s.status === "syncing" && !s.lastSync);
  const footage = useLibrary((s) => s.items);
  const [tab, setTab] = useState<Tab>("clips");
  const [selected, setSelected] = useState<string | null>(null);
  // A fresh edit opens on the clip picker.
  const [picking, setPicking] = useState(() => {
    const e = useHub.getState().edits.find((x) => x.id === id);
    return !!e && !e.clips.length;
  });
  const [exporting, setExporting] = useState(false);

  // Every edit opens at the start.
  useEffect(() => {
    usePlayer.setState({ t: 0, playing: false });
    return () => setPlaying(false);
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && !typing(e.target) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        togglePlaying();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => (edit ? buildCaptions(edit, footage) : []), [edit, footage]);

  if (!edit) {
    return (
      <div>
        <BackButton onClick={onClose} />
        <p className="mt-6 text-[13px] text-muted">
          {syncing ? "Loading the team's edits…" : "This edit isn't here. It may have been deleted."}
        </p>
      </div>
    );
  }

  const selectedClip = edit.clips.find((c) => c.id === selected) ?? edit.clips[0];
  const missing = edit.clips.filter((c) => !footage[c.footageId] || !footage[c.footageId]?.uploaded);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <BackButton onClick={onClose} />
        <input
          value={edit.title}
          onChange={(e) => useHub.getState().updateEdit(id, { title: e.target.value })}
          placeholder="Untitled edit"
          className="min-w-48 flex-1 bg-transparent text-lg font-semibold tracking-tight text-ink placeholder:text-ghost focus:outline-none"
          aria-label="Edit title"
        />
        <Segmented
          value={edit.aspect}
          onChange={(aspect) => useHub.getState().updateEdit(id, { aspect })}
          options={ASPECTS.map((a) => ({ value: a.id, label: <span title={a.hint}>{a.label}</span> }))}
        />
        <Button variant="primary" onClick={() => setExporting(true)} disabled={!edit.clips.length}>
          <Download className="size-3.5" /> Export
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-3">
          <div className="flex justify-center rounded-xl border border-line bg-black/40 p-3">
            <div
              style={{
                width: "100%",
                maxWidth: `calc(58vh * ${aspectSize(edit.aspect).w} / ${aspectSize(edit.aspect).h})`,
                aspectRatio: `${aspectSize(edit.aspect).w} / ${aspectSize(edit.aspect).h}`,
              }}
            >
              <Preview edit={edit} items={footage} groups={groups} className="block h-full w-full rounded-md" />
            </div>
          </div>
          {missing.length > 0 && (
            <p className="flex items-center gap-2 text-xs text-warning">
              <TriangleAlert className="size-3.5" />
              {missing.length === 1 ? "One clip's video" : `${missing.length} clips' videos`} isn&apos;t in the library or
              hasn&apos;t finished uploading.
            </p>
          )}
          <Transport edit={edit} />
          <Timeline
            edit={edit}
            footage={footage}
            selected={selectedClip?.id}
            onSelect={(clipId) => {
              setSelected(clipId);
              setTab("clips");
            }}
          />
        </div>

        <aside className="min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "clips", label: `Clips · ${edit.clips.length}` },
              { value: "captions", label: "Captions" },
              { value: "text", label: "Hook text" },
            ]}
          />
          <div className="pt-4">
            {tab === "clips" && (
              <ClipPanel
                edit={edit}
                footage={footage}
                selected={selectedClip?.id}
                onSelect={setSelected}
                onAdd={() => setPicking(true)}
              />
            )}
            {tab === "captions" && <CaptionPanel edit={edit} footage={footage} />}
            {tab === "text" && <TextPanel edit={edit} />}
          </div>
        </aside>
      </div>

      {picking && <ClipPicker edit={edit} onClose={() => setPicking(false)} onAdded={setSelected} />}
      {exporting && <ExportDialog edit={edit} footage={footage} onClose={() => setExporting(false)} />}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <ArrowLeft className="size-3.5" /> Edits
    </Button>
  );
}

function Transport({ edit }: { edit: Edit }) {
  const t = usePlayer((s) => s.t);
  const playing = usePlayer((s) => s.playing);
  const total = editLength(edit);
  return (
    <div className="flex items-center gap-3">
      <Button
        size="icon"
        onClick={() => {
          // Play from the start again once it has reached the end.
          if (!playing && t >= total - 0.05) seek(0);
          togglePlaying();
        }}
        disabled={!edit.clips.length}
        aria-label={playing ? "Pause" : "Play"}
        data-studio-play
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <span className="font-mono text-xs tabular-nums text-muted" data-studio-time>
        {precise(Math.min(t, total))} <span className="text-ghost">/ {precise(total)}</span>
      </span>
      <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-ghost sm:flex">
        <Kbd>Space</Kbd> play / pause
      </span>
    </div>
  );
}

function Timeline({
  edit,
  footage,
  selected,
  onSelect,
}: {
  edit: Edit;
  footage: Record<string, Footage>;
  selected?: string;
  onSelect: (clipId: string) => void;
}) {
  const t = usePlayer((s) => s.t);
  const total = editLength(edit);
  if (!edit.clips.length) return null;
  return (
    <div
      className="relative flex h-16 cursor-pointer overflow-hidden rounded-lg border border-line bg-surface-2"
      onPointerDown={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        seek(((e.clientX - box.left) / box.width) * total);
      }}
      data-studio-timeline
    >
      {edit.clips.map((c, i) => {
        const item = footage[c.footageId];
        return (
          <div
            key={c.id}
            style={{ width: `${(clipLength(c) / Math.max(total, 1e-6)) * 100}%` }}
            className={cx(
              "relative h-full min-w-1 overflow-hidden border-r-2 border-bg last:border-r-0",
              c.id === selected && "ring-2 ring-inset ring-white/70",
            )}
            onPointerDown={() => onSelect(c.id)}
            title={item?.name}
          >
            {item ? <MomentThumb item={item} at={c.in} className="h-full w-full opacity-80" /> : <div className="h-full bg-surface-3" />}
            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 font-mono text-[10px] tabular-nums text-ink">
              {i + 1} · {clipLength(c).toFixed(1)}s
            </span>
          </div>
        );
      })}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ left: `${(Math.min(t, total) / Math.max(total, 1e-6)) * 100}%` }}
      />
    </div>
  );
}
