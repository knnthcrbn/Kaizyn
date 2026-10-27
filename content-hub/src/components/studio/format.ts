import { timecode } from "@/lib/footage/search";

/** A time to the tenth of a second, for playheads and cut points. */
export const precise = (s: number) => `${timecode(s)}.${Math.floor((s % 1) * 10)}`;
