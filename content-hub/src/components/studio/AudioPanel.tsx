"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Music, Scissors, Trash2, Upload } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { runJob, useJob } from "@/lib/studio/jobs";
import { audioDuration, listAssets, removeDeadSpace, restorePauses, uploadAsset, type StoredAsset } from "@/lib/studio/ops";
import { PAUSE_PRESETS, type PausePreset } from "@/lib/studio/peaks";
import { isAudioFile } from "@/lib/studio/paths";
import { withDefaults, type Edit, type EditMusic } from "@/lib/studio/types";
import { timecode } from "@/lib/footage/search";
import { useHub } from "@/lib/store";
import { Chips, Label, Row, Slider, Toggle } from "./controls";

export function startDeadSpace(editId: string, preset: PausePreset) {
  return runJob("Removing dead space", async (progress) => {
    const r = await removeDeadSpace(editId, preset, (d) => progress(d, "Listening for pauses"));
    return r.count ? `Cut ${r.count} pause${r.count === 1 ? "" : "s"}, ${r.seconds.toFixed(1)}s in all.` : "No pauses long enough to cut.";
  });
}

export function AudioPanel({ edit }: { edit: Edit }) {
  const job = useJob();
  const [preset, setPreset] = useState<PausePreset>("natural");
  const autoCuts = edit.clips.reduce((n, c) => n + (c.cuts ?? []).filter((k) => k.auto).length, 0);
  const update = (patch: Partial<Edit>) => useHub.getState().updateEdit(edit.id, patch);
  const setMusic = (patch: Partial<EditMusic>) =>
    useHub.getState().updateEdit(edit.id, (e) => {
      const m = withDefaults(e).music;
      return m ? { music: { ...m, ...patch } } : {};
    });

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <Label>Dead space</Label>
        <p className="text-[11px] leading-relaxed text-ghost">Cuts the silences between what&apos;s said, from every clip. Pauses you&apos;d rather keep come back with one tap.</p>
        <Chips
          value={preset}
          onChange={setPreset}
          options={(Object.keys(PAUSE_PRESETS) as PausePreset[]).map((k) => ({ value: k, label: `${PAUSE_PRESETS[k].label} (${PAUSE_PRESETS[k].minGap}s+)` }))}
        />
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!!job.label || !edit.clips.length} onClick={() => void startDeadSpace(edit.id, preset)} data-studio-deadspace>
            <Scissors className="size-3.5" /> Remove dead space
          </Button>
          {autoCuts > 0 && (
            <Button variant="ghost" onClick={() => restorePauses(edit.id)}>
              Put {autoCuts} back
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-2.5">
        <Label>Original sound</Label>
        <Slider
          label="Volume"
          value={edit.sourceVolume ?? 1}
          min={0}
          max={2}
          step={0.05}
          onChange={(sourceVolume) => update({ sourceVolume })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <p className="text-[11px] text-ghost">Over 100% is louder in the export; the preview plays it at most at full volume.</p>
      </section>

      <section className="space-y-2.5">
        <Label>Music</Label>
        {edit.music ? (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
              <Music className="size-3.5 text-good-text" />
              <span className="min-w-0 flex-1 truncate text-xs text-ink">{edit.music.name}</span>
              <span className="font-mono text-[11px] tabular-nums text-faint">{timecode(edit.music.duration)}</span>
              <button onClick={() => update({ music: undefined })} className="grid size-6 place-items-center rounded text-faint hover:text-critical-text" aria-label="Remove music">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <Slider label="Volume" value={edit.music.volume} min={0} max={1} step={0.01} onChange={(volume) => setMusic({ volume })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider
              label="Song starts at"
              value={edit.music.start}
              min={0}
              max={Math.max(0, edit.music.duration - 1)}
              step={0.5}
              onChange={(start) => setMusic({ start })}
              format={(v) => timecode(v)}
            />
            <Row label="Fade in">
              <Toggle on={edit.music.fadeIn} onChange={(fadeIn) => setMusic({ fadeIn })} label="Fade in" />
            </Row>
            <Row label="Fade out">
              <Toggle on={edit.music.fadeOut} onChange={(fadeOut) => setMusic({ fadeOut })} label="Fade out" />
            </Row>
          </>
        ) : null}
        <MusicPicker onPick={(music) => update({ music })} replacing={!!edit.music} />
      </section>
    </div>
  );
}

function MusicPicker({ onPick, replacing }: { onPick: (m: EditMusic) => void; replacing: boolean }) {
  const [uploads, setUploads] = useState<StoredAsset[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void listAssets("audio").then(setUploads);
  }, []);

  const pick = async (path: string, name: string, duration?: number) => {
    try {
      const d = duration ?? (await audioDuration(path));
      onPick({ path, name: name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), duration: d, volume: 0.3, start: 0, fadeIn: false, fadeOut: true });
    } catch (e) {
      setError(`Couldn't read that song: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={() => file.current?.click()} className="w-full" disabled={busy != null}>
        {busy != null ? <LoaderCircle className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {busy != null ? `Uploading ${Math.round(busy)}%` : replacing ? "Use a different song" : "Add music or a sound"}
      </Button>
      <input
        ref={file}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!isAudioFile(f)) return setError("That isn't an audio file.");
          setError("");
          try {
            setBusy(0);
            const duration = await audioDuration(f);
            const path = await uploadAsset("audio", f, setBusy);
            setUploads((u) => [{ path, name: f.name, size: f.size, updatedAt: Date.now() }, ...u]);
            await pick(path, f.name, duration);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(null);
          }
        }}
      />
      {error && <p className="text-[11px] text-critical-text">{error}</p>}
      {uploads.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] text-ghost">The team&apos;s sounds</div>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {uploads.map((u) => (
              <li key={u.path}>
                <button onClick={() => void pick(u.path, u.name)} className={cx("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted hover:bg-surface-2 hover:text-ink")}>
                  <Music className="size-3 shrink-0 text-faint" />
                  <span className="truncate">{u.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
