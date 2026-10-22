"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

// A small, safe markdown renderer for Claude replies: headings, lists, bold,
// italics, inline code, fenced code blocks, links, quotes and tables. No raw
// HTML is ever rendered.

// Emphasis only opens and closes at word edges, so ANTHROPIC_API_KEY and
// snake_case stay as written instead of turning into italics.
const INLINE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|(?<![\w*])\*(?!\s)[^*\n]+?(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)[^_\n]+?(?<!\s)_(?![\w_])|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

const linkCls = "text-ink underline decoration-white/25 underline-offset-2 hover:decoration-white/60";

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code key={k++} className="rounded bg-surface-3 px-1 py-px font-mono text-[0.85em] text-ink">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(
        <strong key={k++} className="font-semibold text-ink">
          {inline(tok.slice(2, -2))}
        </strong>,
      );
    } else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(
        <a key={k++} href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
          {inline(label)}
        </a>,
      );
    } else if (tok.startsWith("http")) {
      out.push(
        <a key={k++} href={tok} target="_blank" rel="noopener noreferrer" className={`${linkCls} break-all`}>
          {tok}
        </a>,
      );
    } else {
      out.push(<em key={k++}>{inline(tok.slice(1, -1))}</em>);
    }
    last = i + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg">
      <div className="flex h-7 items-center justify-between border-b border-line px-3 text-[11px] text-faint">
        <span className="font-mono">{lang || "code"}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="inline-flex items-center gap-1 hover:text-ink"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-ink/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} start={list.start} className="ml-5 list-decimal space-y-1 marker:text-faint">
          {items}
        </ol>
      ) : (
        <ul key={blocks.length} className="ml-4 list-disc space-y-1 marker:text-ghost">
          {items}
        </ul>
      ),
    );
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    const fence = line.match(/^\s*```\s*([\w+#.-]*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      blocks.push(<CodeBlock key={blocks.length} code={body.join("\n")} lang={fence[1]} />);
      continue;
    }

    // A table: a header row, a |---| divider, then rows.
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      i--;
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-surface-2 text-muted">
              <tr>
                {head.map((h, j) => (
                  <th key={j} className="px-3 py-1.5 font-medium">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-1.5 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, start: num ? Number(num[1]) : 1, items: [] };
      }
      list.items.push(bullet ? bullet[1] : num![2]);
      continue;
    }
    flush();
    if (!line.trim()) continue;

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (h) {
      blocks.push(
        <p key={blocks.length} className={h[1].length <= 2 ? "pt-2 text-[14px] font-semibold text-ink" : "pt-1 font-semibold text-ink"}>
          {inline(h[2])}
        </p>,
      );
    } else if (quote) {
      const body = [quote[1]];
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) body.push(lines[++i].replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={blocks.length} className="border-l-2 border-line-strong pl-3 text-muted">
          {inline(body.join(" "))}
        </blockquote>,
      );
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={blocks.length} className="border-line" />);
    } else {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <Fragment>{blocks}</Fragment>;
}

/** Pulls list items (or non-empty lines) out of a reply, e.g. to save as hooks. */
export function extractLines(text: string) {
  const items = text
    .split("\n")
    .map((l) => l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)?.[1])
    .filter((x): x is string => !!x);
  const src = items.length ? items : text.split("\n");
  return src
    .map((l) => l.replace(/\*\*/g, "").replace(/^["“]|["”]$/g, "").trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("```"));
}
