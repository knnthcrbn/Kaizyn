"use client";

import { create } from "zustand";

// The Studio's playhead, kept apart from the edit so only the things that show
// the time (the preview, the timeline) re-render while it plays.
//
// `scrubbing` is set while the playhead is being dragged: the preview follows
// the drag frame by frame, and whatever was happening before (playing or
// paused) carries on when it's let go.
export const usePlayer = create<{ t: number; playing: boolean; scrubbing: boolean }>(() => ({
  t: 0,
  playing: false,
  scrubbing: false,
}));

export const seek = (t: number) => usePlayer.setState({ t: Math.max(0, t) });
export const setPlaying = (playing: boolean) => usePlayer.setState({ playing });
export const togglePlaying = () => usePlayer.setState((s) => ({ playing: !s.playing }));
export const setScrubbing = (scrubbing: boolean) => usePlayer.setState({ scrubbing });
