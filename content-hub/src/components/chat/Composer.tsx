"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Layers,
  LoaderCircle,
  Mic,
  MicOff,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import { sendMessage, setChatOptions, stopChat, useChats } from "@/lib/chats";
import { EFFORTS, MODELS, modelInfo, type Effort } from "@/lib/models";
import { IN_CLAUDE } from "@/lib/platform";
import { uid } from "@/lib/store";
import type { ChatAttachment } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { cx } from "../ui";

interface Pending extends ChatAttachment {
  status: "uploading" | "ready" | "error";
  error?: string;
}

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|srt|vtt|log|xml|ya?ml|html?|css|js|jsx|ts|tsx|py|sql|sh)$/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_TEXT = 200_000;
// Claude reads images up to roughly this size; anything bigger only costs upload time.
const MAX_SIDE = 2000;

function kindOf(f: File): ChatAttachment["kind"] | null {
  if (IMAGE_TYPES.has(f.type)) return "image";
  if (f.type === "application/pdf") return "pdf";
  if (f.type.startsWith("text/") || TEXT_EXT.test(f.name)) return "text";
  return null;
}

async function shrink(file: File): Promise<{ blob: Blob; thumb: string }> {
  const bmp = await createImageBitmap(file);
  const draw = (side: number) => {
    const s = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  };
  const thumb = draw(160).toDataURL("image/jpeg", 0.7);
  // Animated GIFs and already-small images go up untouched.
  if (file.type === "image/gif" || (Math.max(bmp.width, bmp.height) <= MAX_SIDE && file.size < 3_500_000)) {
    return { blob: file, thumb };
  }
  const big = draw(MAX_SIDE);
  const blob = await new Promise<Blob>((res, rej) => big.toBlob((b) => (b ? res(b) : rej(new Error())), "image/jpeg", 0.88));
  return { blob, thumb };
}

async function upload(blob: Blob, name: string) {
  const form = new FormData();
  form.append("file", blob, name);
  const res = await fetch("/api/claude/files", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(data.error ?? `Upload failed (${res.status}).`);
  return data.id;
}

export function Composer({
  chatId,
  page,
  compact,
  autoFocus,
}: {
  chatId: string | null;
  page: string;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const chat = useChats((s) => s.chats.find((c) => c.id === chatId) ?? null);
  const defaults = useChats((s) => s.defaults);
  const busy = useChats((s) => !!(chatId && s.streaming[chatId]));
  const opts = chat ?? defaults;

  const [input, setInput] = useState("");
  const [atts, setAtts] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech((said) => setInput((v) => (v ? `${v} ${said}` : said)));

  // Grow with the text, up to a point.
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, compact ? 180 : 280)}px`;
  }, [input, speech.interim, compact]);

  const uploading = atts.some((a) => a.status === "uploading");
  const ready = atts.filter((a) => a.status === "ready");
  const canSend = !busy && !uploading && (!!input.trim() || ready.length > 0);

  const send = () => {
    if (!canSend) return;
    speech.stop();
    const files: ChatAttachment[] = ready.map(({ id, name, kind, mediaType, size, fileId, text, thumb }) => ({
      id,
      name,
      kind,
      mediaType,
      size,
      fileId,
      text,
      thumb,
    }));
    void sendMessage(chatId, input, files, page);
    setInput("");
    setAtts([]);
  };

  const patch = (id: string, p: Partial<Pending>) => setAtts((list) => list.map((a) => (a.id === id ? { ...a, ...p } : a)));

  const addFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      const kind = kindOf(f);
      const base = { id: uid(), name: f.name || "pasted image", mediaType: f.type, size: f.size };
      if (!kind) {
        setAtts((l) => [...l, { ...base, kind: "text", status: "error", error: "Can't read this file type" }]);
        continue;
      }
      if (kind === "text") {
        if (f.size > MAX_TEXT) {
          setAtts((l) => [...l, { ...base, kind, status: "error", error: "Over 200 KB" }]);
          continue;
        }
        setAtts((l) => [...l, { ...base, kind, status: "ready", text: "" }]);
        f.text().then((text) => patch(base.id, { text }));
        continue;
      }
      setAtts((l) => [...l, { ...base, kind, status: "uploading" }]);
      try {
        let blob: Blob = f;
        if (kind === "image") {
          const s = await shrink(f);
          blob = s.blob;
          patch(base.id, { thumb: s.thumb, mediaType: blob.type || f.type });
        }
        const fileId = await upload(blob, base.name);
        patch(base.id, { fileId, status: "ready" });
      } catch (e) {
        patch(base.id, { status: "error", error: (e as Error).message || "Upload failed" });
      }
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    if (IN_CLAUDE || !e.clipboardData.files.length) return;
    e.preventDefault();
    void addFiles(e.clipboardData.files);
  };
  const onDrop = (e: DragEvent) => {
    if (IN_CLAUDE) return;
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        if (IN_CLAUDE) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cx(
        "rounded-xl border bg-surface-2 transition-colors focus-within:border-white/25",
        dragging ? "border-brand/60" : "border-line-strong",
      )}
    >
      {atts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
          {atts.map((a) => (
            <div
              key={a.id}
              title={a.error ?? a.name}
              className={cx(
                "flex h-9 max-w-[200px] items-center gap-2 rounded-lg border bg-surface-3 pl-1 pr-1.5 text-xs",
                a.status === "error" ? "border-critical/40 text-critical-text" : "border-line text-muted",
              )}
            >
              {a.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumb} alt="" className="size-7 rounded object-cover" />
              ) : (
                <span className="grid size-7 place-items-center rounded bg-surface-2">
                  <FileText className="size-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{a.status === "error" ? a.error : a.name}</span>
              {a.status === "uploading" && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-faint" />}
              <button
                onClick={() => setAtts((l) => l.filter((x) => x.id !== a.id))}
                className="shrink-0 rounded p-0.5 text-faint hover:text-ink"
                aria-label={`Remove ${a.name}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={ta}
        data-composer
        autoFocus={autoFocus}
        value={input + (speech.interim ? ` ${speech.interim}` : "")}
        onChange={(e) => setInput(e.target.value)}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        rows={compact ? 2 : 1}
        placeholder={speech.listening ? "Listening…" : compact ? "Ask Claude anything" : "Message Claude"}
        // 16px on phones so iOS doesn't zoom the page when the box is tapped.
        className={cx(
          "block w-full resize-none bg-transparent px-3.5 pt-3 text-base text-ink placeholder:text-ghost focus:outline-none sm:text-[14px]",
          compact ? "min-h-[52px]" : "min-h-[48px]",
        )}
      />

      <div className="flex items-center gap-0.5 px-2 pb-2 pt-1">
        {!IN_CLAUDE && (
          <>
            <IconToggle title="Attach images, PDFs or text files" onClick={() => fileRef.current?.click()}>
              <Paperclip className="size-4" />
            </IconToggle>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/*,.md,.csv,.json,.srt,.vtt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
        {speech.supported && (
          <IconToggle
            title={speech.listening ? "Stop dictating" : "Dictate"}
            on={speech.listening}
            danger
            onClick={speech.listening ? speech.stop : speech.start}
          >
            {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </IconToggle>
        )}
        {!IN_CLAUDE && (
          <>
            <IconToggle
              title={opts.web ? "Web search is on: Claude looks things up when it needs to" : "Web search is off"}
              on={opts.web}
              onClick={() => setChatOptions(chatId, { web: !opts.web })}
            >
              <Globe className="size-4" />
            </IconToggle>
            <IconToggle
              title={
                opts.hub
                  ? "Hub context is on: Claude sees your voice, stories and the open card"
                  : "Hub context is off: plain Claude"
              }
              on={opts.hub}
              onClick={() => setChatOptions(chatId, { hub: !opts.hub })}
            >
              <Layers className="size-4" />
            </IconToggle>
          </>
        )}

        <div className="flex-1" />

        {!IN_CLAUDE && <ModelMenu chatId={chatId} model={opts.model} effort={opts.effort} compact={compact} />}

        {busy ? (
          <button
            onClick={() => chatId && stopChat(chatId)}
            className="ml-1 grid size-8 place-items-center rounded-lg bg-surface-3 text-ink hover:bg-white/15"
            title="Stop"
          >
            <Square className="size-3 fill-current" />
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!canSend}
            className="ml-1 grid size-8 place-items-center rounded-lg bg-ink text-bg transition-opacity disabled:opacity-20"
            title={uploading ? "Waiting for the upload" : "Send (Enter)"}
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function IconToggle({
  children,
  title,
  on,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  on?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "grid size-8 place-items-center rounded-lg transition-colors",
        on
          ? danger
            ? "bg-critical/15 text-critical-text"
            : "bg-surface-3 text-ink"
          : "text-faint hover:bg-surface-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ModelMenu({
  chatId,
  model,
  effort,
  compact,
}: {
  chatId: string | null;
  model: string;
  effort: Effort;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const m = modelInfo(model);
  const e = EFFORTS.find((x) => x.id === effort) ?? EFFORTS[1];

  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent) => {
      if (!box.current?.contains(ev.target as Node)) setOpen(false);
    };
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-surface-3 hover:text-ink"
        title="Model and effort"
      >
        <span className="font-medium text-ink">{m.label}</span>
        <span className="text-ghost">·</span>
        <span>{compact ? e.short : e.label}</span>
        <ChevronDown className="size-3.5 text-faint" />
      </button>
      {open && (
        <div className="fade-in absolute bottom-full right-0 z-30 mb-2 w-[280px] overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/60">
          <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium text-ghost">Model</div>
          <ul className="px-1">
            {MODELS.map((x) => (
              <li key={x.id}>
                <button
                  onClick={() => setChatOptions(chatId, { model: x.id })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink">{x.label}</span>
                    <span className="block text-[11px] text-faint">{x.blurb}</span>
                  </span>
                  {x.id === m.id && <Check className="size-3.5 shrink-0 text-ink" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-line px-3 pb-1 pt-2.5 text-[11px] font-medium text-ghost">Effort</div>
          <div className="grid grid-cols-5 gap-1 px-2 pb-1.5">
            {EFFORTS.map((x) => (
              <button
                key={x.id}
                onClick={() => setChatOptions(chatId, { effort: x.id })}
                className={cx(
                  "h-7 rounded-md text-[11px] font-medium transition-colors",
                  x.id === effort ? "bg-ink text-bg" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink",
                )}
                title={x.blurb}
              >
                {x.short}
              </button>
            ))}
          </div>
          <p className="px-3 pb-2.5 text-[11px] text-faint">{e.blurb}. Higher effort thinks longer and costs more.</p>
        </div>
      )}
    </div>
  );
}
