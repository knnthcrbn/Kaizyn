"use client";

import { useEffect, useState } from "react";
import { AudioTab } from "@/components/analytics/AudioTab";
import { ResultsTab } from "@/components/analytics/ResultsTab";
import { TestsTab } from "@/components/analytics/TestsTab";
import { WorkingTab } from "@/components/analytics/WorkingTab";
import { PageHeader, Tabs } from "@/components/ui";

type Tab = "results" | "working" | "tests" | "audio";
const TABS: Tab[] = ["results", "working", "tests", "audio"];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("results");

  // The tab lives in the URL, so a link can open Tests or Audio directly.
  useEffect(() => {
    const sync = () => {
      const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      setTab(t && TABS.includes(t) ? t : "results");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const go = (t: Tab) => {
    window.history.pushState(null, "", t === "results" ? "/analytics" : `/analytics?tab=${t}`);
    setTab(t);
  };

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Each post's numbers, what's working for your audience, trial reel tests and trending sounds. All of it feeds back into what Claude suggests."
      />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={go}
          options={[
            { value: "results", label: "Results" },
            { value: "working", label: "What's working" },
            { value: "tests", label: "Trial reel tests" },
            { value: "audio", label: "Trending audio" },
          ]}
        />
      </div>
      {tab === "results" && <ResultsTab />}
      {tab === "working" && <WorkingTab />}
      {tab === "tests" && <TestsTab />}
      {tab === "audio" && <AudioTab />}
    </div>
  );
}
