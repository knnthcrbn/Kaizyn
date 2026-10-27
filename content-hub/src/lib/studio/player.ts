"use client";

import { create } from "zustand";

// The Studio's playhead, kept apart from the edit so only the things that show
// the time (the preview, the timeline) re-render while it plays.
export const usePlayer = create<{ t: number; playing: boolean }>(() => ({ t: 0, playing: false }));

export const seek = (t: number) => usePlayer.setState({ t: Math.max(0, t) });
export const setPlaying = (playing: boolean) => usePlayer.setState({ playing });
export const togglePlaying = () => usePlayer.setState((s) => ({ playing: !s.playing }));
