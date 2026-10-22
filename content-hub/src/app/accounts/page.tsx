import { ComingSoon } from "@/components/ComingSoon";

export default function AccountsPage() {
  return (
    <ComingSoon
      title="Accounts & publishing"
      phase="Phase 5"
      pitch="Connect your main profiles and every clipping page, then publish everywhere from one place."
      features={[
        "Instagram (main + clipping pages), TikTok, YouTube, Facebook",
        "One post to many accounts with per-account captions",
        "Staggered post times so clipping pages never post identical content at once",
        "Schedule from the calendar",
        "Finish-in-app handoff for trending audio the APIs won't attach",
        "Results pulled straight into Analytics",
      ]}
      note="Saved for last on purpose. Account details aren't needed until this step."
    />
  );
}
