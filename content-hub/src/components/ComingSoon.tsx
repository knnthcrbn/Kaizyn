import { Check } from "lucide-react";
import { Constellation } from "./Constellation";

/** Placeholder for screens on the roadmap, showing what's coming. */
export function ComingSoon({
  title,
  phase,
  pitch,
  features,
  note,
}: {
  title: string;
  phase: string;
  pitch: string;
  features: string[];
  note?: string;
}) {
  return (
    <div className="glow relative overflow-hidden rounded-3xl border border-line px-6 py-12 sm:px-12 sm:py-16">
      <Constellation className="absolute inset-0 h-full w-full opacity-60" density={0.00006} />
      <div className="relative max-w-2xl">
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          {phase}
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="text-gradient">{title}</span>
        </h1>
        <p className="mt-3 text-muted">{pitch}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2.5 rounded-xl border border-line bg-surface/70 p-3 text-sm text-ink/90 backdrop-blur">
              <Check className="mt-0.5 size-4 shrink-0 text-accent" />
              {f}
            </li>
          ))}
        </ul>
        {note && <p className="mt-6 text-xs text-faint">{note}</p>}
      </div>
    </div>
  );
}
