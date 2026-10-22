import { AudioLines, CalendarClock, Camera, Link2, MonitorPlay, Shuffle } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function AccountsPage() {
  return (
    <ComingSoon
      title="Accounts & publishing"
      phase="Phase 5"
      pitch="Connect your main profiles and every clipping page, then publish everywhere from one place."
      features={[
        { icon: Camera, title: "Instagram", body: "Your main account and every clipping page." },
        { icon: MonitorPlay, title: "YouTube, TikTok, Facebook", body: "Long form and Shorts from the same pipeline." },
        { icon: Link2, title: "One post, many accounts", body: "Per-account captions so nothing looks copy-pasted." },
        { icon: Shuffle, title: "Staggered times", body: "Clipping pages never post identical content at once." },
        { icon: CalendarClock, title: "Scheduling", body: "Queue from the calendar; it goes out on time." },
        { icon: AudioLines, title: "Finish in app", body: "A handoff for trending audio the APIs won't attach." },
      ]}
      note="Saved for last on purpose. Account details aren't needed until this step."
    />
  );
}
