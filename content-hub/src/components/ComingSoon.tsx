import type { LucideIcon } from "lucide-react";
import { Badge, PageHeader } from "./ui";

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
  features: { icon: LucideIcon; title: string; body: string }[];
  note?: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={pitch} actions={<Badge>{phase} · Planned</Badge>} />
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="bg-surface p-5">
            <div className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2">
              <f.icon className="size-4 text-muted" strokeWidth={1.75} />
            </div>
            <div className="mt-4 text-[13px] font-medium text-ink">{f.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-faint">{f.body}</p>
          </div>
        ))}
      </div>
      {note && <p className="mt-4 text-xs text-faint">{note}</p>}
    </div>
  );
}
