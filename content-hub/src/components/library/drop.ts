"use client";

// Files from a drop or a folder picker, with the sub-folder each came from, so
// dropping "Miami trip/Day 1/*.mov" recreates Miami trip/Day 1 in the library.

export interface Picked {
  file: File;
  /** Sub-folder relative to where it was dropped, "" for loose files. */
  dir: string;
}

type Entry = FileSystemEntry;

async function walk(entry: Entry, dir: string, out: Picked[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ file, dir });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const sub = dir ? `${dir}/${entry.name}` : entry.name;
  // readEntries returns at most ~100 at a time; keep reading until it's empty.
  for (;;) {
    const batch = await new Promise<Entry[]>((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    for (const e of batch) await walk(e, sub, out);
  }
}

export async function pickedFromDrop(dt: DataTransfer): Promise<Picked[]> {
  const entries = [...dt.items]
    .map((i) => (i.kind === "file" ? i.webkitGetAsEntry?.() : null))
    .filter((e): e is Entry => !!e);
  if (!entries.length) return [...dt.files].map((file) => ({ file, dir: "" }));
  const out: Picked[] = [];
  for (const e of entries) await walk(e, "", out);
  return out;
}

/** From an <input webkitdirectory>: the chosen folder's name is kept as the top folder. */
export function pickedFromInput(files: FileList): Picked[] {
  return [...files].map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
    return { file, dir: rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "" };
  });
}
