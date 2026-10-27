// Where Studio keeps the files it needs besides footage: uploaded fonts (for
// faces like Druk Wide that can't ship with the app) and music. Same private
// Blob store as the footage, shared by the team.

export type AssetKind = "fonts" | "audio";

export const studioPath = (kind: AssetKind, id: string, name: string) =>
  `studio/${kind}/${id}/${name.replace(/[^\w.\-]+/g, "_").slice(-120)}`;

export const isStudioFile = (path: string) => /^studio\/(fonts|audio)\/[\w-]+\/[\w.\-]+$/.test(path) && !path.includes("..");

export const kindOf = (path: string): AssetKind | null => (path.startsWith("studio/fonts/") ? "fonts" : path.startsWith("studio/audio/") ? "audio" : null);

const FONT_EXT = /\.(otf|ttf|woff2?)$/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i;
export const isFontFile = (f: { name: string }) => FONT_EXT.test(f.name);
export const isAudioFile = (f: { name: string; type?: string }) => f.type?.startsWith("audio/") || AUDIO_EXT.test(f.name);

/** A content type the browser will accept for the file, from its extension when it gives none. */
export function contentTypeFor(name: string, given?: string) {
  if (given) return given;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (
    {
      otf: "font/otf",
      ttf: "font/ttf",
      woff: "font/woff",
      woff2: "font/woff2",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      aac: "audio/aac",
      wav: "audio/wav",
      ogg: "audio/ogg",
      oga: "audio/ogg",
      opus: "audio/ogg",
      flac: "audio/flac",
      webm: "audio/webm",
    }[ext] ?? "application/octet-stream"
  );
}
