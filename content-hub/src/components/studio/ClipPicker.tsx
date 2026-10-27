"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Eye, FileVideo, MapPin, MessageSquareQuote, Plus, Search } from "lucide-react";
import { MomentThumb } from "@/components/library/shared";
import { Button, cx, inputCls } from "@/components/ui";
import { useLibrary } from "@/lib/footage/library";
import { highlight, search, timecode, type HitKind } from "@/lib/footage/search";
import type { Footage } from "@/lib/footage/types";
import { addClip, momentRange, wholeRange } from "@/lib/studio/actions";
import type { Edit } from "@/lib/studio/types";
import { Modal } from "./Modal";

const ALL_KINDS = new Set<HitKind>(["said", "shown", "place", "file"]);
const KIND_ICON = { said: MessageSquareQuote, shown: Eye, place: MapPin, file: FileVideo };

export function ClipPicker({ edit, onClose, onAdded }: { edit: Edit; onClose: () => void; onAdded: (clipId: string) => void }) {
  const loaded = useLibrary((s) => s.loaded);
  const itemsMap = useLibrary((s) => s.items);
  const items = useMemo(
    () => Object.values(itemsMap).filter((i) => i.uploaded).sort((a, b) => b.createdAt - a.createdAt),
    [itemsMap],
  );
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const query = q.trim();
  const long = edit.aspect === "16:9";
  const results = useMemo(() => (query.length >= 2 ? search(items, [query], { kinds: ALL_KINDS, folder: "" }) : []), [items, query]);

  const add = (key: string, item: Footage, range: { from: number; to: number }) => {
    onAdded(addClip(edit.id, item, range.from, range.to));
    setAdded((s) => new Set(s).add(key));
  };

  return (
    <Modal title="Add a clip" onClose={onClose}>
      <div className="border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ghost" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search what's said or shown: Tesla, $1 million month, Fort Lauderdale…"
            className={cx(inputCls, "pl-9")}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!loaded && <p className="p-4 text-xs text-faint">Loading the library…</p>}
        {loaded && !items.length && (
          <p className="p-4 text-xs leading-relaxed text-faint">
            No footage yet. Drop raw videos into the{" "}
            <Link href="/library" className="text-ink underline underline-offset-2">
              footage library
            </Link>{" "}
            first; they become searchable by what&apos;s said and shown.
          </p>
        )}

        {query.length >= 2 ? (
          results.length ? (
            <ul className="space-y-1">
              {results.flatMap((r) =>
                r.hits.slice(0, 6).map((h, i) => {
                  const key = `${r.item.id}:${h.kind}:${h.start}:${i}`;
                  const Icon = KIND_ICON[h.kind];
                  // A line said or a shot shown is the cut; a name or place match takes the video.
                  const range =
                    h.kind === "said"
                      ? momentRange(r.item, h.start)
                      : h.kind === "shown"
                        ? { from: h.start, to: Math.max(h.end, h.start + 2) }
                        : wholeRange(r.item, long);
                  return (
                    <li key={key}>
                      <button
                        onClick={() => add(key, r.item, range)}
                        className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <MomentThumb item={r.item} at={h.start} shot={h.shot} className="h-12 w-20 rounded" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-faint">
                            <Icon className="size-3" />
                            <span className="truncate">{r.item.name}</span>
                            <span className="font-mono tabular-nums">
                              {timecode(range.from)}–{timecode(range.to)}
                            </span>
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink/90">
                            {highlight(h.text, h.terms).map((p, k) =>
                              p.hit ? (
                                <mark key={k} className="rounded-sm bg-white/15 px-0.5 text-ink">
                                  {p.text}
                                </mark>
                              ) : (
                                <span key={k}>{p.text}</span>
                              ),
                            )}
                          </div>
                        </div>
                        <AddMark done={added.has(key)} />
                      </button>
                    </li>
                  );
                }),
              )}
            </ul>
          ) : (
            <p className="p-4 text-xs text-faint">Nothing said or shown matches &quot;{query}&quot;.</p>
          )
        ) : (
          items.length > 0 && (
            <>
              <div className="px-2 pb-1 pt-1 text-[11px] text-ghost">Recent footage</div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.slice(0, 30).map((item) => {
                  const key = `whole:${item.id}`;
                  return (
                    <li key={item.id}>
                      <button onClick={() => add(key, item, wholeRange(item, long))} className="group relative block w-full overflow-hidden rounded-lg border border-line text-left hover:border-line-strong">
                        <MomentThumb item={item} at={0} className="aspect-video w-full" />
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate text-xs text-ink">{item.name}</span>
                          <span className="font-mono text-[10px] tabular-nums text-faint">{timecode(item.duration ?? 0)}</span>
                        </div>
                        <span className="absolute right-1.5 top-1.5">
                          <AddMark done={added.has(key)} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <span className="text-xs text-faint">{added.size ? `${added.size} added. Trim them on the right.` : long ? "Whole videos go on the end of the edit." : "Clips go on the end of the edit."}</span>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function AddMark({ done }: { done: boolean }) {
  return (
    <span className={cx("grid size-6 shrink-0 place-items-center rounded-md", done ? "bg-good/15 text-good-text" : "bg-black/50 text-faint")}>
      {done ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
    </span>
  );
}
