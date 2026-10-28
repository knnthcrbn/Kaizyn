"use client";

import Link from "next/link";
import { useState } from "react";
import { Clapperboard, FolderOpen, MonitorPlay, Smartphone, Sparkles, Trash2 } from "lucide-react";
import { Poster } from "@/components/library/shared";
import { Badge, Button, ConfirmAction, PageHeader } from "@/components/ui";
import { useLibrary } from "@/lib/footage/library";
import { timecode } from "@/lib/footage/search";
import { createEdit } from "@/lib/studio/actions";
import { editLength } from "@/lib/studio/types";
import { useHub } from "@/lib/store";
import { Modal } from "../Modal";
import { LongVideoList } from "./Repurpose";

export function EditList({ onOpen, onOpenLong }: { onOpen: (id: string) => void; onOpenLong: (footageId: string) => void }) {
  const [picking, setPicking] = useState(false);
  const edits = useHub((s) => s.edits);
  const cards = useHub((s) => s.items);
  const deleteEdit = useHub((s) => s.deleteEdit);
  const footage = useLibrary((s) => s.items);
  const sorted = [...edits].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div>
      <PageHeader
        title="Studio"
        description="Cut clips from the footage library into a finished video: trim, cut the dead space, auto captions, zooms, hook text and music, then export for Reels, TikTok or YouTube."
        actions={<NewButtons onOpen={onOpen} onLong={() => setPicking(true)} />}
      />

      {!sorted.length ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <Clapperboard className="size-6 text-ghost" />
          <h2 className="mt-3 text-[13px] font-medium text-ink">No edits yet</h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-faint">
            Start a short (9:16, for Reels, TikTok and Shorts) or a YouTube video (16:9), or open a moment in the footage
            library and choose Edit in Studio.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <NewButtons onOpen={onOpen} onLong={() => setPicking(true)} />
            <Link
              href="/library"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 text-[13px] font-medium text-ink hover:bg-surface-3"
            >
              <FolderOpen className="size-3.5" /> Footage
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((e) => {
            const first = e.clips[0] && footage[e.clips[0].footageId];
            const card = e.cardId ? cards.find((c) => c.id === e.cardId) : undefined;
            return (
              <div key={e.id} className="group relative overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong">
                <button onClick={() => onOpen(e.id)} className="block w-full text-left">
                  <Poster src={first?.poster} className="aspect-video w-full" />
                  <div className="px-3 py-2.5">
                    <div className="truncate text-[13px] font-medium text-ink">{e.title || "Untitled edit"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                      <Badge>{e.aspect}</Badge>
                      <span className="tabular-nums">{timecode(editLength(e))}</span>
                      <span>·</span>
                      <span>
                        {e.clips.length} clip{e.clips.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {card && <div className="mt-1 truncate text-[11px] text-ghost">For: {card.title}</div>}
                  </div>
                </button>
                <div className="absolute right-2 top-2 rounded-lg bg-black/70 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  <ConfirmAction
                    question="Delete this edit?"
                    onConfirm={() => deleteEdit(e.id)}
                    className="grid size-7 place-items-center rounded-lg text-faint hover:text-critical-text"
                    title="Delete edit"
                  >
                    <Trash2 className="size-3.5" />
                  </ConfirmAction>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {picking && (
        <Modal title="Cut a long video into shorts" onClose={() => setPicking(false)} className="max-w-lg">
          <p className="border-b border-line px-4 py-3 text-xs leading-relaxed text-faint">
            Pick a podcast, YouTube video or livestream from the footage library. Claude reads what&apos;s said and picks the
            moments that work as shorts on their own.
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <LongVideoList onPick={(id) => (setPicking(false), onOpenLong(id))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function NewButtons({ onOpen, onLong }: { onOpen: (id: string) => void; onLong: () => void }) {
  return (
    <>
      <Button variant="ai" onClick={onLong} data-studio-repurpose>
        <Sparkles className="size-3.5" /> Shorts from a long video
      </Button>
      <Button variant="primary" onClick={() => onOpen(createEdit())} data-studio-new-short>
        <Smartphone className="size-3.5" /> New short
      </Button>
      <Button onClick={() => onOpen(createEdit({ aspect: "16:9" }))} data-studio-new-youtube>
        <MonitorPlay className="size-3.5" /> New YouTube video
      </Button>
    </>
  );
}
