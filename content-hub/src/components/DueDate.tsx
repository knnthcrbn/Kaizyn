import { CircleAlert } from "lucide-react";
import { dayKey } from "@/lib/store";
import { cx } from "./ui";

/** A due date that turns red when overdue and amber when it's today. */
export function DueDate({ date, className }: { date: string; className?: string }) {
  const today = dayKey();
  const overdue = date < today;
  const isToday = date === today;
  const [y, m, d] = date.split("-").map(Number);
  const label = isToday
    ? "Today"
    : new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs tabular-nums",
        overdue ? "text-critical-text" : isToday ? "text-warning" : "text-faint",
        className,
      )}
      title={overdue ? `Overdue: was due ${label}` : undefined}
    >
      {overdue && <CircleAlert className="size-3" aria-label="Overdue" />}
      {label}
    </span>
  );
}
