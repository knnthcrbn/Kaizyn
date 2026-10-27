"use client";

import { create } from "zustand";

// The long Studio actions (auto captions, AI zoom, removing dead space) run
// one at a time and report here, so the toolbar and panels show the same
// progress whichever started it.
interface JobState {
  label: string | null;
  done: number;
  note: string;
  /** What the last one did, or why it failed; cleared when the next starts. */
  result: string | null;
  error: string | null;
}

export const useJob = create<JobState>(() => ({ label: null, done: 0, note: "", result: null, error: null }));

export async function runJob(label: string, fn: (progress: (done: number, note?: string) => void) => Promise<string>) {
  if (useJob.getState().label) return;
  useJob.setState({ label, done: 0, note: "", result: null, error: null });
  try {
    const result = await fn((done, note) => useJob.setState({ done, note: note ?? useJob.getState().note }));
    useJob.setState({ result });
  } catch (e) {
    useJob.setState({ error: (e as Error).message });
  } finally {
    useJob.setState({ label: null });
  }
}

export const clearJobMessage = () => useJob.setState({ result: null, error: null });
