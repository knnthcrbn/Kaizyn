"use client";

import { useEffect, useState } from "react";
import { CalendarView } from "@/components/plan/CalendarView";
import { GoalsPanel } from "@/components/plan/Goals";
import { RecordingDays } from "@/components/plan/RecordingDays";
import { WeeklyReview } from "@/components/plan/WeeklyReview";
import { PageHeader, Tabs } from "@/components/ui";
import { weekStart } from "@/lib/metrics";
import { useNow } from "@/lib/useNow";

type Tab = "calendar" | "record" | "review" | "goals";
const TABS: Tab[] = ["calendar", "record", "review", "goals"];

// The tab (and the recording day open) live in the URL, so links from Today
// and the command palette land on the right one and Back works.
function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const tab = q.get("tab") as Tab | null;
  return { tab: tab && TABS.includes(tab) ? tab : "calendar", day: q.get("day") };
}

export default function CalendarPage() {
  const [tab, setTab] = useState<Tab>("calendar");
  const [day, setDay] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => {
    const sync = () => {
      const u = readUrl();
      setTab(u.tab);
      setDay(u.day);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const go = (next: Tab, dayId: string | null = null) => {
    const q = new URLSearchParams();
    if (next !== "calendar") q.set("tab", next);
    if (dayId) q.set("day", dayId);
    window.history.pushState(null, "", `/calendar${q.size ? `?${q}` : ""}`);
    setTab(next);
    setDay(dayId);
  };

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="What's going out and when, the goals that give the week its shape, recording days, and the weekly review that closes the loop."
      />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={(t) => go(t)}
          options={[
            { value: "calendar", label: "Calendar" },
            { value: "record", label: "Recording days" },
            { value: "review", label: "Weekly review" },
            { value: "goals", label: "Goals" },
          ]}
        />
      </div>
      {tab === "calendar" && <CalendarView onOpenDay={(id) => go("record", id)} />}
      {tab === "record" && <RecordingDays openId={day} onOpen={(id) => go("record", id)} />}
      {tab === "review" && <WeeklyReview />}
      {tab === "goals" && <GoalsPanel week={weekStart(now)} />}
    </div>
  );
}
