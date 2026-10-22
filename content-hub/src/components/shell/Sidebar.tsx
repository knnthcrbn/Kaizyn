"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { NAV } from "@/lib/nav";
import { dayKey, useHub } from "@/lib/store";
import { streaks } from "@/lib/metrics";
import { cx } from "../ui";
import { BrandMark } from "../BrandMark";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-6 place-items-center rounded-md bg-brand">
        <BrandMark className="size-3.5" />
      </div>
      <span className="text-[13px] font-semibold tracking-tight text-ink">Content Hub</span>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activityDays = useHub((s) => s.activityDays);
  const { current } = streaks(activityDays);
  const set = new Set(activityDays);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: dayKey(d), on: set.has(dayKey(d)), label: d.toLocaleDateString(undefined, { weekday: "narrow" }) };
  });

  return (
    <nav className="flex h-full flex-col px-3 py-3">
      <div className="flex h-9 items-center px-2">
        <Logo />
      </div>

      <div className="mt-4 flex-1 space-y-5 overflow-y-auto">
        {NAV.map((g, gi) => (
          <div key={gi}>
            {g.group && <div className="mb-1 px-2 text-[11px] font-medium text-ghost">{g.group}</div>}
            <ul className="space-y-px">
              {g.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cx(
                        "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors",
                        active ? "bg-surface-3 font-medium text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      <Icon className={cx("size-4", active ? "text-ink" : "text-faint")} strokeWidth={1.75} />
                      <span className={cx("flex-1", item.soon && !active && "text-faint")}>{item.label}</span>
                      {item.soon && <span className="text-[10px] font-medium text-ghost">Soon</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Flame className={cx("size-3.5", current ? "text-warning" : "text-ghost")} />
          <span className="font-medium text-ink">
            {current} day streak
          </span>
        </div>
        <div className="mt-2 flex justify-between">
          {week.map((d) => (
            <div key={d.key} className="flex flex-col items-center gap-1" title={d.key}>
              <span className={cx("size-3.5 rounded-[3px]", d.on ? "bg-heat-3" : "bg-heat-0")} />
              <span className="text-[9px] text-ghost">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
