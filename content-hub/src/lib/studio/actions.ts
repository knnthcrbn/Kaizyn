"use client";

// Starting edits and adding clips, from wherever the idea comes up: a moment
// in the footage library, a card in the pipeline, or the Studio itself.
import type { Footage } from "../footage/types";
import { uid, useHub } from "../store";
import { defaultOverlay, newClip, type Edit } from "./types";
import { newUndoStep } from "./undo";

/** A sensible cut around a moment: the sentence being said there, else ten seconds from it. */
export function momentRange(item: Footage, at: number) {
  const end = item.duration ?? at + 10;
  const line = item.transcript?.find((l) => l.start <= at + 0.05 && l.end >= at);
  if (line) return { from: Math.max(0, line.start - 0.2), to: Math.min(end, line.end + 0.35) };
  return { from: Math.max(0, at - 0.5), to: Math.min(end, Math.max(at - 0.5, 0) + 10) };
}

/**
 * For a short (or a vertical edit), the whole video if it's short, else its
 * first 15 seconds; trim from there. A YouTube edit takes the whole video.
 */
export function wholeRange(item: Footage, long = false) {
  const d = item.duration ?? 15;
  return { from: 0, to: long || d <= 60 ? d : 15 };
}

export function addClip(editId: string, item: Footage, from: number, to: number) {
  const clip = newClip(item.id, from, to, uid());
  newUndoStep();
  useHub.getState().updateEdit(editId, (e) => ({ clips: [...e.clips, clip] }));
  return clip.id;
}

export function createEdit(partial: Partial<Edit> = {}) {
  return useHub.getState().addEdit(partial);
}

/** The edit already made for a card, or a new one with the card's title and overlay. */
export function editForCard(cardId: string) {
  const s = useHub.getState();
  const existing = s.edits.find((e) => e.cardId === cardId);
  if (existing) return existing.id;
  const card = s.items.find((i) => i.id === cardId);
  return s.addEdit({
    title: card?.title ?? "Untitled edit",
    cardId,
    overlay: { ...defaultOverlay(), text: card?.overlay ?? "" },
  });
}

export const studioUrl = (editId?: string) => (editId ? `/studio?e=${editId}` : "/studio");
