// Starting points for captions and hook text, like CapCut's text templates.
// Picking one sets every control; anything can be changed after.
import { leadlabCaptions, youtubeCaptions, defaultOverlay, type EditCaptions, type EditOverlay, type TextLook } from "./types";

const stroke = (on: boolean, color = "#000000", width = 7) => ({ on, color, width });
const shadow = (on: boolean, color = "#000000", opacity = 0.5, blur = 0, distance = 4, angle = 45) => ({ on, color, opacity, blur, distance, angle });
const box = (on: boolean, color = "#000000", opacity = 0.7, radius = 14, padX = 24, padY = 12) => ({
  on,
  color,
  opacity,
  radius,
  padX,
  padY,
  border: stroke(false, "#000000", 4),
});

const look = (patch: Partial<TextLook>): TextLook => ({ ...leadlabCaptions().style, ...patch });
type CaptionPatch = Omit<Partial<EditCaptions>, "style" | "highlight"> & {
  style?: Partial<TextLook>;
  highlight?: Partial<EditCaptions["highlight"]>;
};
const caption = (patch: CaptionPatch): EditCaptions => {
  const base = leadlabCaptions();
  return { ...base, ...patch, style: look(patch.style ?? {}), highlight: { ...base.highlight, ...(patch.highlight ?? {}) } };
};

export const CAPTION_PRESETS: { id: string; label: string; make: () => EditCaptions }[] = [
  { id: "leadlab", label: "LeadLab bold", make: leadlabCaptions },
  {
    id: "punchy",
    label: "Punchy",
    make: () => caption({ animation: "pop", highlight: { on: true, mode: "color", color: "#3DFF6E", boxColor: "#7C3AED", scale: 1.12 }, style: { stroke: stroke(true, "#000000", 9) } }),
  },
  {
    id: "wide",
    label: "Wide (Druk style)",
    make: () =>
      caption({
        words: 2,
        style: { font: "unbounded", size: 92, stroke: stroke(true, "#000000", 6), shadow: shadow(true, "#000000", 0.6, 0, 5, 90) },
        highlight: { on: true, mode: "color", color: "#FFE14D", boxColor: "#7C3AED", scale: 1 },
      }),
  },
  {
    id: "karaoke",
    label: "Karaoke box",
    make: () =>
      caption({
        animation: "pop",
        style: { stroke: stroke(false), shadow: shadow(true, "#000000", 0.45, 16, 0, 90) },
        highlight: { on: true, mode: "box", color: "#FFFFFF", boxColor: "#7C3AED", scale: 1.06 },
      }),
  },
  {
    id: "boxed",
    label: "Black box",
    make: () => caption({ style: { stroke: stroke(false), shadow: shadow(false), box: box(true, "#000000", 0.85, 12, 22, 10), size: 84 }, highlight: { on: true, mode: "color", color: "#FFE14D", boxColor: "#7C3AED", scale: 1 } }),
  },
  {
    id: "clean",
    label: "Clean white",
    make: () => caption({ style: { stroke: stroke(false), shadow: shadow(true, "#000000", 0.55, 18, 0, 90) }, highlight: { on: false, mode: "color", color: "#FFE14D", boxColor: "#7C3AED", scale: 1 } }),
  },
  {
    id: "neon",
    label: "Neon glow",
    make: () =>
      caption({
        style: { color: "#FFFFFF", stroke: stroke(false), shadow: shadow(true, "#00E5FF", 1, 28, 0, 90) },
        highlight: { on: true, mode: "color", color: "#00E5FF", boxColor: "#7C3AED", scale: 1 },
        animation: "fade",
      }),
  },
  {
    id: "bouncy",
    label: "Bouncy",
    make: () => caption({ animation: "bounce", style: { font: "luckiest", size: 104, stroke: stroke(true, "#000000", 8) }, highlight: { on: true, mode: "color", color: "#FFE14D", boxColor: "#7C3AED", scale: 1 } }),
  },
  {
    id: "tall",
    label: "Tall",
    make: () => caption({ words: 3, style: { font: "anton", size: 132, stroke: stroke(true, "#000000", 6) }, highlight: { on: true, mode: "color", color: "#FF3B30", boxColor: "#7C3AED", scale: 1 } }),
  },
  {
    id: "type",
    label: "Typewriter",
    make: () =>
      caption({
        animation: "typewriter",
        words: 4,
        style: { font: "serif", italic: true, upper: false, size: 104, stroke: stroke(false), shadow: shadow(true, "#000000", 0.6, 14, 0, 90) },
        highlight: { on: false, mode: "color", color: "#FFE14D", boxColor: "#7C3AED", scale: 1 },
      }),
  },
  {
    id: "minimal",
    label: "Minimal",
    make: () =>
      caption({
        animation: "fade",
        words: 4,
        style: { font: "geist", upper: false, size: 70, stroke: stroke(false), shadow: shadow(true, "#000000", 0.5, 12, 0, 90) },
        highlight: { on: false, mode: "color", color: "#FFE14D", boxColor: "#7C3AED", scale: 1 },
      }),
  },
  { id: "youtube", label: "YouTube", make: youtubeCaptions },
];

const overlay = (style: Partial<TextLook>, extra: Partial<EditOverlay> = {}): Partial<EditOverlay> => ({
  ...extra,
  style: { ...defaultOverlay().style, ...style },
});

export const HOOK_PRESETS: { id: string; label: string; make: () => Partial<EditOverlay> }[] = [
  { id: "ig", label: "Instagram white", make: () => ({ style: defaultOverlay().style }) },
  { id: "black", label: "Black box", make: () => overlay({ color: "#FFFFFF", box: box(true, "#000000", 0.92, 16, 28, 20) }) },
  { id: "glass", label: "Glass", make: () => overlay({ color: "#FFFFFF", box: box(true, "#000000", 0.45, 22, 30, 20), shadow: shadow(false) }) },
  { id: "lilac", label: "Lilac", make: () => overlay({ color: "#0B0B0C", box: box(true, "#B2B1FF", 1, 18, 28, 20) }) },
  { id: "yellow", label: "Yellow sticker", make: () => overlay({ font: "archivo", color: "#000000", box: { ...box(true, "#FFE14D", 1, 10, 26, 18), border: stroke(true, "#000000", 4) } }) },
  { id: "red", label: "Red caps", make: () => overlay({ font: "montserrat", upper: true, size: 50, color: "#FFFFFF", box: box(true, "#FF3B30", 1, 8, 24, 16) }) },
  {
    id: "outline",
    label: "Outline, no box",
    make: () => overlay({ font: "montserrat", size: 64, color: "#FFFFFF", stroke: stroke(true, "#000000", 7), box: box(false), shadow: shadow(true, "#000000", 0.5, 0, 4, 45) }),
  },
  {
    id: "wide",
    label: "Wide headline",
    make: () => overlay({ font: "unbounded", size: 58, upper: true, color: "#FFFFFF", stroke: stroke(false), box: box(false), shadow: shadow(true, "#000000", 0.7, 20, 0, 90) }, { animation: "pop" }),
  },
];
