import { Fragment, type ReactNode } from "react";

// A tiny, safe markdown renderer for Claude replies: headings, bullets,
// numbered lists, bold, italics and inline code. No raw HTML.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k++} className="rounded bg-surface-3 px-1 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={blocks.length}
        className={list.ordered ? "ml-5 list-decimal space-y-1" : "ml-4 list-disc space-y-1 marker:text-accent/70"}
      >
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push(
        <p key={blocks.length} className="pt-1 text-[13px] font-semibold uppercase tracking-wide text-accent">
          {inline(h[2])}
        </p>,
      );
    } else if (/^-{3,}$/.test(line.trim())) {
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
    .filter((l) => l && !l.startsWith("#"));
}
