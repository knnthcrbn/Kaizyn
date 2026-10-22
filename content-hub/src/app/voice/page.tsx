"use client";

import { useState } from "react";
import { Mic, Square, Sparkles, Trash2, Save } from "lucide-react";
import { LintPanel } from "@/components/LintPanel";
import { Button, PageHeader, Panel, cx, inputCls } from "@/components/ui";
import { ANTI_AI_RULES } from "@/lib/antiAi";
import { streamClaude } from "@/lib/claude";
import { useHub } from "@/lib/store";
import { useSpeech } from "@/lib/useSpeech";

const PROMPTS = [
  "Tell me about a mistake that cost you money.",
  "What's something you believe about business that most people don't?",
  "What did today look like? Just walk me through it.",
  "What would you tell yourself five years ago?",
  "Explain what you do to a friend who has no clue about marketing.",
  "What's annoying you about your industry right now?",
];

export default function VoicePage() {
  const entries = useHub((s) => s.voiceEntries);
  const add = useHub((s) => s.addVoiceEntry);
  const remove = useHub((s) => s.deleteVoiceEntry);
  const profile = useHub((s) => s.voiceProfile);
  const setProfile = useHub((s) => s.setVoiceProfile);
  const speech = useSpeech();
  const [draft, setDraft] = useState("");
  const [building, setBuilding] = useState(false);
  const [testText, setTestText] = useState("");
  const [prompt, setPrompt] = useState(PROMPTS[0]);

  const transcript = [draft, speech.finalText, speech.interim].filter(Boolean).join(" ");
  const totalWords = entries.reduce((n, e) => n + e.text.split(/\s+/).length, 0);

  const saveTake = () => {
    const text = [draft, speech.finalText].filter(Boolean).join(" ").trim();
    if (!text) return;
    speech.stop();
    add(text, speech.finalText ? "recording" : "typed");
    setDraft("");
    speech.reset();
  };

  const rebuild = async () => {
    setBuilding(true);
    setProfile("");
    await streamClaude(
      [
        {
          role: "user",
          content:
            "Study my voice samples and write my voice profile: a practical guide another writer could follow to sound exactly like me on camera. Cover: how I open and close thoughts, sentence length and rhythm, filler and signature phrases I actually use (quote them), words and tones I'd never use, how I explain things, my energy. Then 5 short example lines in my voice. Be specific to the samples; don't make anything up. Plain text with short headings.",
        },
      ],
      "Voice Lab screen",
      setProfile,
    );
    setBuilding(false);
  };

  return (
    <div>
      <PageHeader
        title="Voice Lab"
        subtitle="AI sounds robotic when it has nothing of yours to copy. Talk here for a few minutes a day. Every take goes into your voice corpus, and Claude writes from it."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Panel title="Talk it out">
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-faint">Prompt:</span>
                <button
                  onClick={() => setPrompt(PROMPTS[(PROMPTS.indexOf(prompt) + 1) % PROMPTS.length])}
                  className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent hover:bg-accent/15"
                >
                  {prompt} ↻
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={speech.listening ? speech.stop : speech.start}
                  disabled={!speech.supported}
                  className={cx(
                    "relative grid size-16 shrink-0 place-items-center rounded-full transition-all disabled:opacity-40",
                    speech.listening
                      ? "bg-bad text-white shadow-[0_0_0_8px_rgb(252_165_165/0.15)]"
                      : "bg-accent text-accent-ink shadow-[0_0_30px_-4px_rgb(178_177_255/0.7)] hover:scale-105",
                  )}
                >
                  {speech.listening ? <Square className="size-5" /> : <Mic className="size-6" />}
                  {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-bad/30" />}
                </button>
                <div className="text-sm text-muted">
                  {!speech.supported
                    ? "Live transcription needs Chrome, Edge or Safari. You can still type or paste below."
                    : speech.listening
                      ? "Listening. Talk like you would to a friend. Rambling is good."
                      : "Hit the mic and just talk. Don't perform, don't fix it."}
                  {speech.error && <div className="mt-1 text-xs text-bad">Mic error: {speech.error}</div>}
                </div>
              </div>

              <textarea
                value={transcript}
                onChange={(e) => {
                  speech.reset();
                  setDraft(e.target.value);
                }}
                rows={7}
                placeholder="Your words show up here. You can also paste a transcript from a voice memo, a podcast, or a video you've already made."
                className={inputCls}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-faint">
                  {transcript.trim() ? transcript.trim().split(/\s+/).length : 0} words
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      speech.stop();
                      speech.reset();
                      setDraft("");
                    }}
                  >
                    Discard
                  </Button>
                  <Button variant="primary" onClick={saveTake} disabled={!transcript.trim()}>
                    <Save className="size-4" /> Save to my voice
                  </Button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title={`Voice corpus · ${entries.length} takes · ${totalWords.toLocaleString()} words`}
            action={<span className="text-xs text-faint">Aim for 3,000+ words</span>}
          >
            <div className="h-1 bg-surface-3">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, (totalWords / 3000) * 100)}%` }} />
            </div>
            <ul className="divide-y divide-line">
              {entries.map((e) => (
                <li key={e.id} className="group flex gap-3 px-4 py-3">
                  <div className="flex-1">
                    <div className="mb-1 text-[11px] text-faint">
                      {e.source === "seed" ? "From your first voice note" : e.source === "recording" ? "Recorded" : "Typed / pasted"} ·{" "}
                      {e.text.split(/\s+/).length} words
                    </div>
                    <p className="line-clamp-3 text-sm text-muted">{e.text}</p>
                  </div>
                  <button onClick={() => remove(e.id)} className="h-fit text-faint opacity-0 hover:text-bad group-hover:opacity-100">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Panel
            title="Voice profile"
            action={
              <Button size="sm" variant="primary" onClick={rebuild} disabled={building || !entries.length}>
                <Sparkles className="size-3.5" /> {building ? "Building…" : profile ? "Rebuild" : "Build"}
              </Button>
            }
          >
            <div className="p-4">
              <textarea
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                rows={14}
                placeholder="Build it from your corpus. Claude reads it before writing anything for you. Edit it any time."
                className={cx(inputCls, "text-[13px] leading-relaxed")}
              />
            </div>
          </Panel>

          <Panel title="Anti-AI check">
            <div className="space-y-3 p-4">
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={5}
                placeholder="Paste any script or caption to check it."
                className={inputCls}
              />
              <LintPanel text={testText} />
              <details className="text-xs text-muted">
                <summary className="cursor-pointer text-faint hover:text-ink">
                  The {ANTI_AI_RULES.length} rules every script is checked against
                </summary>
                <ul className="mt-2 space-y-1">
                  {ANTI_AI_RULES.map((r) => (
                    <li key={r.id}>
                      <span className="text-ink">{r.label}</span> <span className="text-faint">· {r.why}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
