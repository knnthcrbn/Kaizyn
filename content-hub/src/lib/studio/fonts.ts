"use client";

// Fonts for captions and hook text. The built-in ones are Google Fonts loaded
// by the app (app/layout.tsx), each only when a caption uses it. Any other
// face, like Druk Wide (a paid font from Commercial Type that can't ship with
// the app), is uploaded once as a file and shared with the team.
import { fileUrl } from "../footage/api";

export interface FontChoice {
  id: string;
  label: string;
  /** The CSS variable app/layout.tsx puts the family name in. */
  cssVar: string;
  weight: number;
  /** How wide its capitals run next to Montserrat ExtraBold (1). Sets how many letters fit on a line. */
  width: number;
  group: "Bold" | "Wide" | "Tall" | "Fun" | "Serif";
}

export const FONTS: FontChoice[] = [
  { id: "montserrat", label: "Montserrat ExtraBold", cssVar: "--font-caption", weight: 800, width: 1, group: "Bold" },
  { id: "poppins", label: "Poppins ExtraBold", cssVar: "--font-poppins", weight: 800, width: 1.02, group: "Bold" },
  { id: "archivo", label: "Archivo Black", cssVar: "--font-archivo", weight: 400, width: 1.05, group: "Bold" },
  { id: "geist", label: "Geist Bold", cssVar: "--font-geist-sans", weight: 700, width: 0.92, group: "Bold" },
  { id: "unbounded", label: "Unbounded Black", cssVar: "--font-unbounded", weight: 900, width: 1.4, group: "Wide" },
  { id: "anton", label: "Anton", cssVar: "--font-anton", weight: 400, width: 0.7, group: "Tall" },
  { id: "bebas", label: "Bebas Neue", cssVar: "--font-bebas", weight: 400, width: 0.6, group: "Tall" },
  { id: "oswald", label: "Oswald Bold", cssVar: "--font-oswald", weight: 700, width: 0.72, group: "Tall" },
  { id: "luckiest", label: "Luckiest Guy", cssVar: "--font-luckiest", weight: 400, width: 1.05, group: "Fun" },
  { id: "bangers", label: "Bangers", cssVar: "--font-bangers", weight: 400, width: 0.82, group: "Fun" },
  { id: "marker", label: "Permanent Marker", cssVar: "--font-marker", weight: 400, width: 1, group: "Fun" },
  { id: "serif", label: "Instrument Serif", cssVar: "--font-serif", weight: 400, width: 0.78, group: "Serif" },
];

const FALLBACK = "'Arial Black', Arial, sans-serif";
const UPLOADED = "file:";

export const uploadedFontId = (path: string) => `${UPLOADED}${path}`;
export const isUploaded = (id: string) => id.startsWith(UPLOADED);
export const uploadedName = (id: string) =>
  id
    .slice(UPLOADED.length)
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ");

const familyOf = (path: string) => `HubFont${[...path].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36)}`;

function cssVar(name: string) {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const choice = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];

export function fontLabel(id: string) {
  return isUploaded(id) ? uploadedName(id) : choice(id).label;
}

export function fontFamily(id: string) {
  if (isUploaded(id)) return `"${familyOf(id.slice(UPLOADED.length))}", ${FALLBACK}`;
  return cssVar(choice(id).cssVar) || FALLBACK;
}

/** A canvas font string. Faces without an italic get a slanted copy from the browser. */
export function fontSpec(id: string, px: number, italic: boolean) {
  const weight = isUploaded(id) ? 400 : choice(id).weight;
  return `${italic ? "italic " : ""}${weight} ${Math.max(1, px).toFixed(1)}px ${fontFamily(id)}`;
}

/** Uploaded faces are usually display fonts; assume a wide one (Druk Wide runs about 1.6). */
export const fontWidth = (id: string) => (isUploaded(id) ? 1.5 : choice(id).width);

const loading = new Map<string, Promise<void>>();

/** Makes sure a font is ready before drawing with it; resolves even if it can't load (the fallback draws instead). */
export function ensureFont(id: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  let p = loading.get(id);
  if (p) return p;
  if (isUploaded(id)) {
    const path = id.slice(UPLOADED.length);
    const face = new FontFace(familyOf(path), `url(${fileUrl(path)})`);
    p = face
      .load()
      .then((f) => {
        document.fonts.add(f);
      })
      .catch(() => {});
  } else {
    p = document.fonts
      .load(fontSpec(id, 100, false))
      .then(() => {})
      .catch(() => {});
  }
  loading.set(id, p);
  return p;
}

/** The font as a CSS font-family, for previews of a style in the panels. */
export function cssFamily(id: string) {
  if (isUploaded(id)) return fontFamily(id);
  return `var(${choice(id).cssVar}), ${FALLBACK}`;
}

export const cssWeight = (id: string) => (isUploaded(id) ? 400 : choice(id).weight);
