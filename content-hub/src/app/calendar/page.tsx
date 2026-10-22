import { ComingSoon } from "@/components/ComingSoon";

export default function CalendarPage() {
  return (
    <ComingSoon
      title="Calendar"
      phase="Phase 3"
      pitch="See the week and month at a glance and set posting goals per pillar, so the habit has a shape."
      features={[
        "Week and month view of everything due, scheduled and posted",
        "Drag to reschedule",
        "Posting goals per pillar and platform",
        "Batch recording days: line up 5 to 10 scripts and run them on the teleprompter",
        "Weekly review: what worked, what's next",
        "Reminders when the pipeline runs dry",
      ]}
    />
  );
}
