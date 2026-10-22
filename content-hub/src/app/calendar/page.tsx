import { CalendarDays, Clapperboard, Goal, MoveHorizontal, RefreshCcw, BellRing } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function CalendarPage() {
  return (
    <ComingSoon
      title="Calendar"
      phase="Phase 3"
      pitch="The week and month at a glance, with posting goals that give the habit a shape."
      features={[
        { icon: CalendarDays, title: "Week and month views", body: "Everything due, scheduled and posted in one place." },
        { icon: MoveHorizontal, title: "Drag to reschedule", body: "Move a post and its due dates follow." },
        { icon: Goal, title: "Posting goals", body: "Targets per pillar and platform, tracked against the week." },
        { icon: Clapperboard, title: "Batch recording days", body: "Line up 5 to 10 scripts and run them on the teleprompter." },
        { icon: RefreshCcw, title: "Weekly review", body: "What worked, what didn't, what to test next." },
        { icon: BellRing, title: "Nudges", body: "A heads-up when the pipeline is about to run dry." },
      ]}
    />
  );
}
