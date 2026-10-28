"use client";

import { useEffect, useState } from "react";
import { ClippersTab } from "@/components/clipping/ClippersTab";
import { DropsTab } from "@/components/clipping/DropsTab";
import { OverviewTab } from "@/components/clipping/OverviewTab";
import { PayoutsTab } from "@/components/clipping/PayoutsTab";
import { ReviewTab } from "@/components/clipping/ReviewTab";
import { PageHeader, Tabs } from "@/components/ui";
import { loadLibrary } from "@/lib/footage/library";
import { useHub } from "@/lib/store";

type Tab = "overview" | "drops" | "clippers" | "review" | "payouts";
const TABS: Tab[] = ["overview", "drops", "clippers", "review", "payouts"];

export default function ClippingPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const pending = useHub((s) => s.submissions.filter((x) => x.status === "pending").length);

  useEffect(() => {
    // Drops pick their video from the footage library.
    void loadLibrary();
    const sync = () => {
      const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      setTab(t && TABS.includes(t) ? t : "overview");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const go = (t: Tab) => {
    window.history.pushState(null, "", t === "overview" ? "/clipping" : `/clipping?tab=${t}`);
    setTab(t);
  };

  return (
    <div>
      <PageHeader
        title="Clipping"
        description="Your clippers and the pages they run: drop a clip to all of them at once, check every post's proof, and pay only for views from the United States."
      />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={go}
          options={[
            { value: "overview", label: "Overview" },
            { value: "drops", label: "Drops" },
            { value: "clippers", label: "Clippers" },
            { value: "review", label: `Review${pending ? ` · ${pending}` : ""}` },
            { value: "payouts", label: "Payouts" },
          ]}
        />
      </div>
      {tab === "overview" && <OverviewTab onReview={() => go("review")} />}
      {tab === "drops" && <DropsTab />}
      {tab === "clippers" && <ClippersTab />}
      {tab === "review" && <ReviewTab />}
      {tab === "payouts" && <PayoutsTab />}
    </div>
  );
}
