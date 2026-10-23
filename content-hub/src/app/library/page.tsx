"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ChevronRight,
  Eye,
  Folder,
  FolderInput,
  FolderPlus,
  Layers,
  LoaderCircle,
  MapPin,
  MessageSquareQuote,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button, cx, PageHeader } from "@/components/ui";
import { Detail } from "@/components/library/Detail";
import { pickedFromDrop, pickedFromInput, type Picked } from "@/components/library/drop";
import { formatDate, MomentThumb, Poster, statusOf } from "@/components/library/shared";
import { api } from "@/lib/footage/api";
import {
  addFolder,
  addVideos,
  allFolders,
  deleteFolder,
  isVideoFile,
  loadLibrary,
  renameFolder,
  updateFootage,
  useLibrary,
} from "@/lib/footage/library";
import { highlight, search, timecode, type HitKind } from "@/lib/footage/search";
import type { Footage } from "@/lib/footage/types";
import { IN_CLAUDE } from "@/lib/platform";

const KINDS: { id: HitKind; label: string; icon: typeof Eye }[] = [
  { id: "said", label: "Said", icon: MessageSquareQuote },
  { id: "shown", label: "Shown", icon: Eye },
  { id: "place", label: "Place", icon: MapPin },
  { id: "file", label: "Names & tags", icon: Layers },
];

export default function LibraryPage() {
  if (IN_CLAUDE) {
    return (
      <div>
        <PageHeader title="Footage" description="The footage library stores video for the whole team, so it runs in the hosted hub, not this claude.ai copy." />
      </div>
    );
  }
  return <Library />;
}

function Library() {
  const loaded = useLibrary((s) => s.loaded);
  const error = useLibrary((s) => s.error);
  const itemsMap = useLibrary((s) => s.items);
  const savedFolders = useLibrary((s) => s.folders);
  const jobs = useLibrary((s) => s.jobs);
  const items = useMemo(() => Object.values(itemsMap).sort((a, b) => b.createdAt - a.createdAt), [itemsMap]);
  const folders = useMemo(() => allFolders({ folders: savedFolders, items: itemsMap }), [savedFolders, itemsMap]);

  const [folder, setFolder] = useState("");
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<Set<HitKind>>(new Set(["said", "shown", "place", "file"]));
  const [smart, setSmart] = useState(true);
  const [expanded, setExpanded] = useState<{ q: string; terms: string[] } | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [open, setOpen] = useState<{ id: string; at?: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadLibrary(true);
    // A shared link: /library?v=<id>&t=<seconds>
    const params = new URLSearchParams(window.location.search);
    const v = params.get("v");
    // Reading the link once on arrival; there's no external system to sync with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v) setOpen({ id: v, at: Number(params.get("t")) || undefined });
  }, []);

  // Wider terms from Claude, a moment after typing stops.
  const query = q.trim();
  useEffect(() => {
    if (!smart || query.length < 2 || expanded?.q === query) return;
    const timer = setTimeout(() => {
      setExpanding(true);
      api
        .expand(query)
        .then(({ terms }) => setExpanded({ q: query, terms }))
        .catch(() => setExpanded({ q: query, terms: [query] }))
        .finally(() => setExpanding(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [query, smart, expanded?.q]);

  const terms = useMemo(() => {
    if (!query) return [];
    if (smart && expanded?.q === query) return [query, ...expanded.terms.filter((t) => t !== query.toLowerCase())];
    return [query];
  }, [query, smart, expanded]);

  const results = useMemo(
    () => (terms.length ? search(items, terms, { kinds, folder }) : []),
    [items, terms, kinds, folder],
  );

  const add = useCallback(
    async (picked: Picked[]) => {
      const videos = picked.filter((p) => isVideoFile(p.file));
      // Dropped folders become folders here, under the one being viewed.
      const byFolder = new Map<string, File[]>();
      for (const p of videos) {
        const target = [folder, p.dir].filter(Boolean).join("/");
        byFolder.set(target, [...(byFolder.get(target) ?? []), p.file]);
      }
      for (const f of byFolder.keys()) if (f && !folders.includes(f)) await addFolder(f);
      for (const [f, files] of byFolder) await addVideos(files, f);
    },
    [folder, folders],
  );

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    // A card dragged onto the page is a move, handled by the folder rows.
    if (e.dataTransfer.types.includes("text/footage-id")) return;
    await add(await pickedFromDrop(e.dataTransfer));
  };

  // "All footage" is everything, newest first; a folder shows what's directly in it.
  const inFolder = folder ? items.filter((i) => i.folder === folder) : items;
  const subfolders = folders.filter((f) => (folder ? f.startsWith(`${folder}/`) : true) && f.split("/").length === (folder ? folder.split("/").length + 1 : 1));
  const busy = Object.values(jobs).filter((j) => j.stage !== "done" && j.stage !== "error").length;

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
      className="relative"
    >
      <PageHeader
        title="Footage"
        description="Every raw video in one place, searchable by what's said and what's on screen. Drop videos or whole folders anywhere on this page."
        actions={
          <>
            <Button onClick={() => folderInput.current?.click()}>
              <FolderInput className="size-3.5" /> Upload a folder
            </Button>
            <Button variant="primary" onClick={() => fileInput.current?.click()}>
              <Upload className="size-3.5" /> Upload videos
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="video/*,.mov,.mp4,.m4v"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void add([...e.target.files].map((file) => ({ file, dir: "" })));
                e.target.value = "";
              }}
            />
            <input
              ref={folderInput}
              type="file"
              multiple
              className="hidden"
              {...({ webkitdirectory: "" } as Record<string, string>)}
              onChange={(e) => {
                if (e.target.files) void add(pickedFromInput(e.target.files));
                e.target.value = "";
              }}
            />
          </>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <FolderRail current={folder} folders={folders} items={items} onPick={setFolder} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 transition-colors focus-within:border-white/25">
            <Search className="size-4 shrink-0 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Search what was said or shown: "Tesla", "$1 million a month", "Fort Lauderdale"'
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ghost focus:outline-none sm:text-[14px]"
            />
            {expanding && <LoaderCircle className="size-4 shrink-0 animate-spin text-faint" />}
            {q && (
              <button onClick={() => setQ("")} className="rounded p-1 text-faint hover:text-ink" aria-label="Clear">
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {KINDS.map((k) => {
              const on = kinds.has(k.id);
              return (
                <button
                  key={k.id}
                  onClick={() =>
                    setKinds((prev) => {
                      const next = new Set(prev);
                      if (on && next.size > 1) next.delete(k.id);
                      else next.add(k.id);
                      return next;
                    })
                  }
                  className={cx(
                    "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                    on ? "border-line-strong bg-surface-3 text-ink" : "border-line text-faint hover:text-muted",
                  )}
                >
                  <k.icon className="size-3.5" /> {k.label}
                </button>
              );
            })}
            <button
              onClick={() => setSmart((v) => !v)}
              title="Claude widens the search: 'a million a month' also finds '$1M/month'"
              className={cx(
                "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                smart ? "border-brand/30 bg-brand/10 text-brand" : "border-line text-faint hover:text-muted",
              )}
            >
              <Sparkles className="size-3.5" /> Smart search
            </button>
            {folder && query && <span className="text-xs text-faint">in {folder}</span>}
          </div>
          {smart && expanded?.q === query && terms.length > 1 && (
            <p className="mt-2 text-xs text-faint">
              Also searching: {terms.slice(1).map((t, i) => (
                <span key={t}>
                  {i > 0 && ", "}
                  <span className="text-muted">{t}</span>
                </span>
              ))}
            </p>
          )}

          {error && <p className="mt-4 text-[13px] text-critical-text">Couldn&apos;t load the library: {error}</p>}

          <div className="mt-5">
            {query ? (
              <Results results={results} onOpen={(id, at) => setOpen({ id, at })} />
            ) : (
              <>
                {busy > 0 && (
                  <p className="mb-3 flex items-center gap-2 text-xs text-muted">
                    <LoaderCircle className="size-3.5 animate-spin" /> Working on {busy} video{busy === 1 ? "" : "s"}. Keep this tab open until they finish.
                  </p>
                )}
                {subfolders.length > 0 && (
                  <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {subfolders.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFolder(f)}
                        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-[13px] text-muted hover:border-line-strong hover:text-ink"
                      >
                        <Folder className="size-4 shrink-0 text-faint" />
                        <span className="truncate">{f.split("/").pop()}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!loaded ? (
                  <p className="text-xs text-faint">Loading…</p>
                ) : inFolder.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {inFolder.map((i) => (
                      <Card key={i.id} item={i} onOpen={() => setOpen({ id: i.id })} />
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-16 text-center hover:bg-surface"
                  >
                    <Upload className="mb-3 size-6 text-faint" />
                    <span className="text-[13px] font-medium text-ink">Drop raw videos or folders here</span>
                    <span className="mt-1 max-w-sm text-xs text-faint">
                      Each one is transcribed and described as it uploads, so you can search &quot;dog&quot;, &quot;Tesla&quot; or
                      &quot;Fort Lauderdale&quot; and land on the moment.
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-[2px]">
          <div className="rounded-2xl border border-dashed border-white/30 bg-surface/90 px-10 py-8 text-center">
            <Upload className="mx-auto mb-2 size-6 text-ink" />
            <p className="text-[14px] font-medium text-ink">Drop to add to {folder || "the library"}</p>
            <p className="mt-1 text-xs text-faint">Folders keep their structure.</p>
          </div>
        </div>
      )}

      {open && useLibrary.getState().items[open.id] && (
        <Detail
          id={open.id}
          at={open.at}
          terms={terms}
          onClose={() => {
            setOpen(null);
            const url = new URL(window.location.href);
            if (url.searchParams.has("v")) {
              url.searchParams.delete("v");
              url.searchParams.delete("t");
              window.history.replaceState(null, "", url);
            }
          }}
        />
      )}
    </div>
  );
}

function FolderRail({
  current,
  folders,
  items,
  onPick,
}: {
  current: string;
  folders: string[];
  items: Footage[];
  onPick: (f: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const count = (f: string) => items.filter((i) => i.folder === f || i.folder.startsWith(`${f}/`)).length;

  const moveHere = async (e: DragEvent, f: string) => {
    const id = e.dataTransfer.getData("text/footage-id");
    setOver(null);
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    await updateFootage(id, { folder: f });
  };

  const row = (f: string, label: string, depth: number) => (
    <li key={f || "__all"} className="group relative">
      {editing === f ? (
        <input
          autoFocus
          defaultValue={label}
          onBlur={async (e) => {
            const name = e.target.value.trim();
            const parent = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "";
            setEditing(null);
            if (name && name !== label) {
              const to = parent ? `${parent}/${name}` : name;
              await renameFolder(f, to);
              if (current === f) onPick(to);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(null);
          }}
          className="h-8 w-full rounded-md border border-line-strong bg-surface-2 px-2 text-base text-ink focus:outline-none sm:text-[13px]"
        />
      ) : (
        <button
          onClick={() => onPick(f)}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("text/footage-id")) {
              e.preventDefault();
              setOver(f);
            }
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => void moveHere(e, f)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={cx(
            "flex h-8 w-full items-center gap-2 rounded-md pr-14 text-left text-[13px] transition-colors",
            current === f ? "bg-surface-3 font-medium text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
            over === f && "ring-1 ring-brand/50",
          )}
        >
          {f ? <Folder className="size-4 shrink-0 text-faint" /> : <Layers className="size-4 shrink-0 text-faint" />}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="text-[11px] text-ghost group-hover:hidden">{f ? count(f) : items.length}</span>
        </button>
      )}
      {f && editing !== f && (
        <span className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
          <button onClick={() => setEditing(f)} className="rounded p-1 text-faint hover:text-ink" title="Rename">
            <Pencil className="size-3" />
          </button>
          <button
            onClick={async () => {
              if (current === f || current.startsWith(`${f}/`)) onPick("");
              await deleteFolder(f);
            }}
            className="rounded p-1 text-faint hover:text-critical-text"
            title="Delete folder (its videos move up a level)"
          >
            <Trash2 className="size-3" />
          </button>
        </span>
      )}
    </li>
  );

  const crumbs = current ? current.split("/") : [];

  return (
    <aside className="lg:w-56 lg:shrink-0">
      {crumbs.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-faint lg:hidden">
          <button onClick={() => onPick("")} className="hover:text-ink">
            All footage
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              <button onClick={() => onPick(crumbs.slice(0, i + 1).join("/"))} className="hover:text-ink">
                {c}
              </button>
            </span>
          ))}
        </nav>
      )}
      <ul className="hidden space-y-px lg:block">
        {row("", "All footage", 0)}
        {folders.map((f) => row(f, f.split("/").pop()!, f.split("/").length - 1))}
      </ul>
      <select
        value={current}
        onChange={(e) => onPick(e.target.value)}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 px-2 text-base text-ink [color-scheme:dark] sm:text-[13px] lg:hidden"
      >
        <option value="">All footage ({items.length})</option>
        {folders.map((f) => (
          <option key={f} value={f}>
            {f} ({count(f)})
          </option>
        ))}
      </select>
      {adding ? (
        <input
          autoFocus
          placeholder={current ? `New folder in ${current.split("/").pop()}` : "Folder name"}
          onBlur={async (e) => {
            setAdding(false);
            const path = await addFolder(e.target.value, current);
            if (path) onPick(path);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setAdding(false);
          }}
          className="mt-2 h-8 w-full rounded-md border border-line-strong bg-surface-2 px-2 text-base text-ink placeholder:text-ghost focus:outline-none sm:text-[13px]"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-faint hover:bg-surface-2 hover:text-ink"
        >
          <FolderPlus className="size-4" /> New folder
        </button>
      )}
    </aside>
  );
}

function Card({ item, onOpen }: { item: Footage; onOpen: () => void }) {
  const job = useLibrary((s) => s.jobs[item.id]);
  const status = statusOf(item, job);
  const portrait = (item.height ?? 0) > (item.width ?? 1);
  return (
    <button
      onClick={onOpen}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/footage-id", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group overflow-hidden rounded-xl border border-line bg-surface text-left transition-colors hover:border-line-strong"
    >
      <div className="relative">
        <Poster src={item.poster} className={cx("w-full", portrait ? "aspect-[4/5]" : "aspect-video")} />
        {item.duration ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {timecode(item.duration)}
          </span>
        ) : null}
        {status.tone !== "ready" && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6">
            <div
              className={cx(
                "flex items-center gap-1.5 text-[11px]",
                status.tone === "error" ? "text-critical-text" : "text-white/85",
              )}
            >
              {status.tone === "busy" && <LoaderCircle className="size-3 animate-spin" />}
              {status.label}
              {status.pct != null && ` ${Math.round(status.pct)}%`}
            </div>
            {status.pct != null && (
              <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-white/80 transition-[width]" style={{ width: `${status.pct}%` }} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <div className="truncate text-[13px] font-medium text-ink">{item.name}</div>
        <div className="mt-0.5 truncate text-[11px] text-faint">
          {[formatDate(item.recordedAt), item.location?.place].filter(Boolean).join(" · ") || " "}
        </div>
      </div>
    </button>
  );
}

function Results({
  results,
  onOpen,
}: {
  results: ReturnType<typeof search>;
  onOpen: (id: string, at?: number) => void;
}) {
  if (!results.length) {
    return (
      <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-[13px] text-faint">
        Nothing matches yet. Try another word, or turn on Smart search.
      </p>
    );
  }
  const moments = results.reduce((n, r) => n + r.hits.length, 0);
  return (
    <div>
      <p className="mb-3 text-xs text-faint">
        {moments} moment{moments === 1 ? "" : "s"} in {results.length} video{results.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-4">
        {results.map(({ item, hits }) => (
          <section key={item.id} className="overflow-hidden rounded-xl border border-line bg-surface">
            <button onClick={() => onOpen(item.id)} className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left hover:bg-surface-2">
              <Poster src={item.poster} className="h-9 w-14 rounded" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{item.name}</span>
                <span className="block truncate text-[11px] text-faint">
                  {[item.folder || "Top level", item.duration ? timecode(item.duration) : "", item.location?.place].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="text-[11px] text-faint">
                {hits.length} moment{hits.length === 1 ? "" : "s"}
              </span>
            </button>
            <ul className="divide-y divide-line">
              {hits.slice(0, 8).map((h, i) => {
                const K = KINDS.find((k) => k.id === h.kind)!;
                return (
                  <li key={i}>
                    <button onClick={() => onOpen(item.id, h.kind === "said" || h.kind === "shown" ? h.start : undefined)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                      <MomentThumb item={item} at={h.start} shot={h.shot} className="h-12 w-20 rounded" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[11px] text-faint">
                          <K.icon className="size-3" />
                          {K.label}
                          {(h.kind === "said" || h.kind === "shown") && <span className="font-mono text-muted">{timecode(h.start)}</span>}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-muted">
                          {highlight(h.text, h.terms).map((p, k) =>
                            p.hit ? (
                              <mark key={k} className="rounded bg-warning/25 px-0.5 text-ink">
                                {p.text}
                              </mark>
                            ) : (
                              <span key={k}>{p.text}</span>
                            ),
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {hits.length > 8 && (
                <li>
                  <button onClick={() => onOpen(item.id)} className="w-full px-3 py-2 text-left text-xs text-faint hover:bg-surface-2 hover:text-ink">
                    {hits.length - 8} more in this video
                  </button>
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
