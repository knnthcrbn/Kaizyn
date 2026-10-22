"use client";

import { useState } from "react";
import { Mic, RefreshCw, Save, Sparkles, Square, Trash2 } from "lucide-react";
import { LintPanel } from "@/components/LintPanel";
import { Badge, Button, Card, PageHeader, cx, inputCls } from "@/components/ui";
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

const GOAL = 3000;

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
  const pct = Math.min(100, Math.round((totalWords / GOAL) * 100));

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
        description="AI sounds robotic when it has nothing of yours to copy. Talk here for a few minutes a day; every take goes into your voice corpus, and Claude writes from it."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Words in your corpus" value={totalWords.toLocaleString()} foot={`Goal ${GOAL.toLocaleString()}`}>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cx("h-full rounded-full", pct >= 100 ? "bg-good" : "bg-ink")} style={{ width: `${pct}%` }} />
          </div>
        </Metric>
        <Metric label="Takes" value={String(entries.length)} foot="Recorded, typed or pasted" />
        <Metric
          label="Voice profile"
          value={profile ? "Built" : "Not built"}
          foot={profile ? "Claude reads it before writing" : "Build it once you have a few takes"}
          tone={profile ? "good" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card title="Talk it out" description="Don't perform and don't fix it. Rambling is the point.">
            <div className="space-y-4 px-4 pb-4 pt-3">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                <span className="text-xs text-faint">Prompt</span>
                <span className="flex-1 text-[13px] text-ink">{prompt}</span>
                <button
                  onClick={() => setPrompt(PROMPTS[(PROMPTS.indexOf(prompt) + 1) % PROMPTS.length])}
                  className="rounded-md p-1 text-faint hover:bg-surface-3 hover:text-ink"
                  title="Another prompt"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={speech.listening ? speech.stop : speech.start}
                  disabled={!speech.supported}
                  className={cx(
                    "relative grid size-12 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40",
                    speech.listening ? "bg-critical text-white" : "bg-ink text-bg hover:bg-white",
                  )}
                  title={speech.listening ? "Stop" : "Start talking"}
                >
                  {speech.listening ? <Square className="size-4" /> : <Mic className="size-5" />}
                  {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-critical/30" />}
                </button>
                <div className="text-[13px] text-muted">
                  {!speech.supported
                    ? "Live transcription needs Chrome, Edge or Safari. You can still type or paste below."
                    : speech.listening
                      ? "Recording. Talk like you would to a friend."
                      : "Press to start talking."}
                  {speech.error && <div className="mt-1 text-xs text-critical-text">Mic error: {speech.error}</div>}
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
                <span className="text-xs tabular-nums text-faint">
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
                    <Save className="size-3.5" /> Save take
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Corpus" description="Everything Claude learns your voice from">
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {entries.map((e) => (
                <li key={e.id} className="group flex gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-faint">
                      <Badge>{e.source === "seed" ? "First voice note" : e.source === "recording" ? "Recorded" : "Typed"}</Badge>
                      <span className="tabular-nums">{e.text.split(/\s+/).length} words</span>
                      <span>·</span>
                      <span>{new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                    <p className="line-clamp-2 text-[13px] text-muted">{e.text}</p>
                  </div>
                  <button
                    onClick={() => remove(e.id)}
                    className="h-fit rounded-md p-1 text-ghost opacity-0 hover:text-critical-text group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Voice profile"
            description="Edit it any time"
            action={
              <Button size="sm" variant="ai" onClick={rebuild} disabled={building || !entries.length}>
                <Sparkles className="size-3" /> {building ? "Building…" : profile ? "Rebuild" : "Build"}
              </Button>
            }
          >
            <div className="px-4 pb-4 pt-3">
              <textarea
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                rows={14}
                placeholder="Build it from your corpus. Claude reads it before writing anything for you."
                className={cx(inputCls, "text-xs leading-relaxed")}
              />
            </div>
          </Card>

          <Card title="Anti-AI check" description={`${ANTI_AI_RULES.length} rules every script is checked against`}>
            <div className="space-y-3 px-4 pb-4 pt-3">
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={5}
                placeholder="Paste any script or caption to check it"
                className={inputCls}
              />
              <LintPanel text={testText} />
              <details className="text-xs text-muted">
                <summary className="cursor-pointer text-faint hover:text-ink">See the rules</summary>
                <ul className="mt-2 space-y-1">
                  {ANTI_AI_RULES.map((r) => (
                    <li key={r.id}>
                      <span className="text-ink">{r.label}</span> <span className="text-faint">· {r.why}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  foot,
  tone,
  children,
}: {
  label: string;
  value: string;
  foot: string;
  tone?: "good";
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div
        className={cx(
          "mt-2 text-xl font-semibold tracking-tight",
          tone === "good" ? "text-good-text" : "text-ink",
        )}
      >
        {value}
      </div>
      {children}
      <div className="mt-2 text-[11px] text-ghost">{foot}</div>
    </div>
  );
}
