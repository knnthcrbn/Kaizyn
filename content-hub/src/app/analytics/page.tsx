import { ComingSoon } from "@/components/ComingSoon";

export default function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      phase="Phase 4"
      pitch="Close the loop: results flow back into every card, and the hub learns what works for your audience."
      features={[
        "Views, retention, shares, saves and follows per post",
        "Tag what worked: hook type, pillar, overlay, length, post time",
        "Trial reel A/B log for hooks and overlay text",
        "Trending audio tracker for your niche",
        "Claude uses your winners when it writes new hooks and scripts",
        "Weekly report: double down, drop, test next",
      ]}
    />
  );
}
