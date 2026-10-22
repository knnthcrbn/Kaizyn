import { Activity, AudioLines, FlaskConical, LineChart, Sparkles, Tags } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      phase="Phase 4"
      pitch="Results flow back into every card, and the hub learns what works for your audience."
      features={[
        { icon: LineChart, title: "Per-post results", body: "Views, retention, shares, saves and follows on each card." },
        { icon: Tags, title: "What worked", body: "Compare by hook type, pillar, overlay, length and post time." },
        { icon: FlaskConical, title: "Trial reel log", body: "A/B results for hooks and overlay text, winner marked." },
        { icon: AudioLines, title: "Trending audio", body: "Sounds picking up in your niche, ready to add in-app." },
        { icon: Sparkles, title: "Smarter Claude", body: "Your winners feed into the hooks and scripts it writes." },
        { icon: Activity, title: "Weekly report", body: "Double down, drop, test next." },
      ]}
    />
  );
}
