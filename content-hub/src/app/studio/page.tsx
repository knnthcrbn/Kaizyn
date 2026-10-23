import { Captions, Download, Film, Layers, Scissors, Search } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function StudioPage() {
  return (
    <ComingSoon
      title="Studio"
      phase="Phase 2"
      pitch="Edit and export without leaving the hub, built on the same patterns as LeadLab Studio."
      features={[
        { icon: Search, title: "Footage library", body: "Every raw video in folders, searchable by what's said and shown. Type \"Tesla\" or \"$1M month\" and jump to the moment." },
        { icon: Scissors, title: "Trim and cut", body: "Open raw footage straight from a card and cut it down." },
        { icon: Captions, title: "Auto-captions", body: "Word-level timing, styled to your brand, burned in on export." },
        { icon: Layers, title: "Hook overlays", body: "Pull the hook and overlay text from the card, ready for trial reels." },
        { icon: Download, title: "Multi-format export", body: "9:16, 1:1 and 16:9 in one go." },
        { icon: Film, title: "Repurpose", body: "Turn one YouTube video into suggested short clips, each a new card." },
      ]}
    />
  );
}
