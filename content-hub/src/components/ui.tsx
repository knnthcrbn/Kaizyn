"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { PILLAR_STYLE, STAGES, pillarLabel, stageIndex } from "@/lib/meta";
import type { Pillar, StageId } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "ai" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "icon" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-8 px-3 text-[13px]",
        size === "icon" && "size-8",
        variant === "primary" && "bg-ink text-bg hover:bg-white",
        variant === "secondary" && "border border-line-strong bg-surface-2 text-ink hover:bg-surface-3",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
        variant === "ai" && "bg-brand/10 text-brand ring-1 ring-inset ring-brand/25 hover:bg-brand/15",
        variant === "danger" && "text-critical-text hover:bg-critical/10",
        className,
      )}
    />
  );
}

export function PillarTag({ pillar, className }: { pillar: Pillar; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <span className={cx("size-2 rounded-[3px]", PILLAR_STYLE[pillar].dot)} />
      {pillarLabel(pillar)}
    </span>
  );
}

/** Progress ring for a stage: dashed when untouched, filling as it moves, a check when live. */
export function StageIcon({ stage, className }: { stage: StageId; className?: string }) {
  const i = stageIndex(stage);
  const done = stage === "posted" || stage === "analysed";
  const size = 14;
  const r = 5.5;
  const pie = 1.75; // inner pie radius; drawn as a thick stroke so it fills like a clock
  const pieC = 2 * Math.PI * pie;
  if (done) {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className={cx("shrink-0", className)} aria-hidden>
        <circle cx="7" cy="7" r="6.5" className="fill-good" />
        <path d="M4.3 7.2l1.8 1.8 3.6-3.8" fill="none" stroke="#0b0b0c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const frac = i / (STAGES.length - 3); // fills up to Scheduled
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={cx("shrink-0", className)} aria-hidden>
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        strokeWidth="1.5"
        className="stroke-faint"
        strokeDasharray={i === 0 ? "2 2" : undefined}
      />
      {i > 0 && (
        <circle
          cx="7"
          cy="7"
          r={pie}
          fill="none"
          strokeWidth={pie * 2}
          className="stroke-muted"
          strokeDasharray={`${frac * pieC} ${pieC}`}
          transform="rotate(-90 7 7)"
        />
      )}
    </svg>
  );
}

export function StageTag({ stage, className }: { stage: StageId; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <StageIcon stage={stage} />
      {STAGES.find((s) => s.id === stage)?.label}
    </span>
  );
}

type Tone = "neutral" | "good" | "warning" | "critical" | "brand";

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "bg-surface-3 text-muted",
        tone === "good" && "bg-good/12 text-good-text",
        tone === "warning" && "bg-warning/12 text-warning",
        tone === "critical" && "bg-critical/15 text-critical-text",
        tone === "brand" && "bg-brand/12 text-brand",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Week-over-week change: arrow + sign + colour, so it never relies on colour alone. */
export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-faint">
        <Minus className="size-3" /> 0{suffix}
      </span>
    );
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-good-text" : "text-critical-text")}>
      <Icon className="size-3.5" />
      {up ? "+" : "−"}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  description,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pb-1 pt-3.5">
          <div>
            <h2 className="text-[13px] font-medium text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-faint">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Pill-style segmented control for switching views and filters. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-lg border border-line bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-surface-3 text-ink shadow-sm" : "text-faint hover:text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="flex gap-4 border-b border-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "-mb-px border-b py-2 text-[13px] transition-colors",
            value === o.value ? "border-ink font-medium text-ink" : "border-transparent text-faint hover:text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ghost transition-colors focus:border-white/25 focus:outline-none";

export const selectCls =
  "h-8 rounded-lg border border-line-strong bg-surface-2 px-2 text-xs text-ink focus:border-white/25 focus:outline-none [color-scheme:dark]";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-surface-2 px-1 py-px font-sans text-[10px] font-medium text-faint">
      {children}
    </kbd>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-xs text-faint">{children}</div>;
}
