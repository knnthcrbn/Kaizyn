"use client";

import { useState } from "react";
import { AudioLines, ExternalLink, Plus, Sparkles, Trash2 } from "lucide-react";
import { FieldLabel, PlatformChips, PlatformDot } from "@/components/plan/bits";
import { Button, Card, ConfirmAction, Empty, Segmented, cx, inputCls } from "@/components/ui";
import { compact, median } from "@/lib/insights";
import { useHub } from "@/lib/store";
import type { Platform, Sound } from "@/lib/types";

const STATUSES: { id: Sound["status"]; label: string; hint: string }[] = [
  { id: "spotted", label: "Spotted", hint: "Picking up; worth watching" },
  { id: "saved", label: "Saved", hint: "Saved in the app, ready to use" },
  { id: "used", label: "Used", hint: "On a post already" },
  { id: "faded", label: "Faded", hint: "The trend's over" },
];

/** Trending sounds: spotted in the app, planned onto posts, added in-app when posting. */
export function AudioTab() {
  const sounds = useHub((s) => s.sounds);
  const posts = useHub((s) => s.posts);
  const askClaude = useHub((s) => s.askClaude);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [notes, setNotes] = useState("");

  const add = () => {
    useHub.getState().addRecord("sounds", { name: name.trim(), artist: artist.trim(), url: url.trim(), platform, status: "spotted", pillars: [], notes: notes.trim() });
    setName("");
    setArtist("");
    setUrl("");
    setNotes("");
    setAdding(false);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start gap-3 p-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2">
            <AudioLines className="size-4 text-muted" />
          </div>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-faint">
            Instagram and TikTok don&apos;t let other apps attach the music from their libraries, so a trending sound is always added in the app at the
            moment you post. Track the sounds you spot here, put one on a post when you schedule it, and the post reminds whoever posts it to add it.
            Results then show whether trending sounds beat your own audio.
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setAdding((a) => !a)} data-sound-add>
          <Plus className="size-3.5" /> Add a sound
        </Button>
        <Button
          variant="ai"
          onClick={() =>
            askClaude(
              "Search the web: which sounds are trending on Instagram Reels and TikTok right now that would fit my pillars (business, lifestyle B-roll, personal story)? For each: the sound name and artist, a link if you find one, how creators are using it, and whether it's early or already peaking. Cite your sources.",
            )
          }
        >
          <Sparkles className="size-3.5" /> Ask Claude what&apos;s trending
        </Button>
      </div>

      {adding && (
        <Card>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Sound</FieldLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} className={cx(inputCls, "h-8 py-0")} placeholder="Its name in the app" data-sound-name />
            </label>
            <label className="block">
              <FieldLabel>Artist</FieldLabel>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} className={cx(inputCls, "h-8 py-0")} />
            </label>
            <label className="block sm:col-span-2">
              <FieldLabel>Link</FieldLabel>
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={cx(inputCls, "h-8 py-0")} placeholder="instagram.com/reels/audio/… or a TikTok sound link" />
            </label>
            <div className="sm:col-span-2">
              <FieldLabel>Where it&apos;s trending</FieldLabel>
              <PlatformChips value={[platform]} onChange={([p]) => setPlatform(p)} only={["instagram", "tiktok", "youtube"]} />
            </div>
            <label className="block sm:col-span-2">
              <FieldLabel>How it&apos;s being used</FieldLabel>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={cx(inputCls, "h-8 py-0")} placeholder="The format or joke that goes with it" />
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={add} disabled={!name.trim()} data-sound-save>
                Save sound
              </Button>
            </div>
          </div>
        </Card>
      )}

      {sounds.length ? (
        <div className="grid gap-3 lg:grid-cols-2" data-sounds>
          {STATUSES.map((st) => {
            const list = sounds.filter((x) => x.status === st.id);
            if (!list.length) return null;
            return (
              <Card key={st.id} title={`${st.label} · ${list.length}`} description={st.hint}>
                <ul className="divide-y divide-line border-t border-line">
                  {list.map((x) => (
                    <SoundRow key={x.id} sound={x} uses={posts.filter((p) => p.soundId === x.id)} />
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty>No sounds tracked yet. When one keeps coming up on your feed, add it here.</Empty>
      )}
    </div>
  );
}

function SoundRow({ sound, uses }: { sound: Sound; uses: { status: string; results?: { views?: number } }[] }) {
  const views = uses.map((u) => u.results?.views).filter((v): v is number => v != null);
  return (
    <li className="space-y-1.5 px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs">
        <PlatformDot platform={sound.platform} />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-ink">{sound.name}</span>
          {sound.artist && <span className="text-faint"> · {sound.artist}</span>}
        </span>
        {sound.url && (
          <a href={sound.url} target="_blank" rel="noreferrer" className="text-faint hover:text-ink" aria-label="Open sound">
            <ExternalLink className="size-3.5" />
          </a>
        )}
        <ConfirmAction question="Remove?" confirmLabel="Remove" onConfirm={() => useHub.getState().deleteRecord("sounds", sound.id)} className="text-faint hover:text-critical-text" title="Remove sound">
          <Trash2 className="size-3.5" />
        </ConfirmAction>
      </div>
      {sound.notes && <p className="text-[11px] text-faint">{sound.notes}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={sound.status}
          onChange={(status) => useHub.getState().updateRecord("sounds", sound.id, { status })}
          options={STATUSES.map((s) => ({ value: s.id, label: s.label }))}
        />
        <span className="text-[11px] text-faint">
          {uses.length ? `On ${uses.length} post${uses.length === 1 ? "" : "s"}` : "Not on a post yet"}
          {views.length ? ` · median ${compact(median(views))} views` : ""}
        </span>
      </div>
    </li>
  );
}
