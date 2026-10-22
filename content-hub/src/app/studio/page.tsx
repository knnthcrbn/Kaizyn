import { ComingSoon } from "@/components/ComingSoon";

export default function StudioPage() {
  return (
    <ComingSoon
      title="Studio"
      phase="Phase 2"
      pitch="Edit and export without leaving the hub, built on the same patterns as LeadLab Studio."
      features={[
        "Trim and cut raw footage straight from a card",
        "Auto-captions with word-level timing, styled in your brand",
        "Hook overlays and banners from the card, ready for trial reels",
        "Export 9:16, 1:1 and 16:9 in one go",
        "Repurpose: turn one YouTube video into suggested short clips",
        "B-roll library, tagged, so text-on-B-roll posts take minutes",
      ]}
    />
  );
}
