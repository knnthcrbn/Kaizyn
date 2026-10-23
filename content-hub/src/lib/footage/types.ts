// The footage library's records, shared by the server routes and the browser.

/** A stretch of what was said, from the transcript. */
export interface FootageLine {
  start: number;
  end: number;
  text: string;
}

/** A stretch of what was on screen, described by Claude from sampled frames. */
export interface FootageShot {
  start: number;
  end: number;
  description: string;
  /** Lowercase nouns for search: "dog", "tesla model 3", "beach". */
  tags: string[];
  /** Words visible on screen (signs, captions, logos). */
  onScreenText?: string;
}

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface Footage {
  id: string;
  /** Shown title; starts as the file name. */
  name: string;
  /** "" for the top level, "Lifestyle/Miami" for nested folders. */
  folder: string;
  file: { path: string; name: string; size: number; type: string };
  createdAt: number;
  updatedAt: number;
  duration?: number;
  width?: number;
  height?: number;
  /** When it was filmed, from the file's own metadata. */
  recordedAt?: number;
  /** Where it was filmed, from the phone's GPS tag. */
  location?: { lat: number; lon: number; place?: string };
  /** A small frame for the grid, as a data URL. */
  poster?: string;
  tags: string[];
  notes?: string;
  uploaded: boolean;
  steps: { transcript: StepStatus; visuals: StepStatus };
  /** What went wrong in the last processing run, per step. */
  errors?: { transcript?: string; visuals?: string; upload?: string };
  transcript?: FootageLine[];
  shots?: FootageShot[];
  /** Interval between sampled frames, in seconds; shot thumbnails key off it. */
  frameEvery?: number;
}

/**
 * A change to a record. Steps merge one by one on the server, and an error set
 * to null is cleared, so two steps finishing at once can't undo each other.
 */
export type FootagePatch = Omit<Partial<Footage>, "steps" | "errors"> & {
  steps?: Partial<Footage["steps"]>;
  errors?: { [K in keyof NonNullable<Footage["errors"]>]?: string | null };
};

/** Per-shot thumbnails, kept apart from the record so the catalog stays light. */
export type FootageThumbs = Record<number, string>;

export const PATHS = {
  file: (id: string, name: string) => `footage/files/${id}/${name.replace(/[^\w.\-]+/g, "_").slice(-120)}`,
  meta: (id: string) => `footage/meta/${id}.json`,
  thumbs: (id: string) => `footage/thumbs/${id}.json`,
  folders: "footage/folders.json",
};

export const isFootageFile = (path: string) => /^footage\/files\/[\w-]+\/[\w.\-]+$/.test(path);
export const isFootageAsset = (path: string) => /^footage\/(files|meta|thumbs)\/[\w./-]+$/.test(path) && !path.includes("..");
