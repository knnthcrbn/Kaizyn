import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Bookmark,
  Home,
  KanbanSquare,
  Lightbulb,
  Link2,
  Mic,
  Sparkles,
  Settings,
  Library,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roadmap phase for screens that aren't built yet. */
  soon?: string;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Create",
    items: [
      { href: "/", label: "Today", icon: Home },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/ideas", label: "Ideas", icon: Lightbulb },
    ],
  },
  {
    group: "Write",
    items: [
      { href: "/voice", label: "Voice Lab", icon: Mic },
      { href: "/hooks", label: "Hooks & overlays", icon: Sparkles },
      { href: "/stories", label: "Story bank", icon: BookOpen },
      { href: "/swipe", label: "Swipe file", icon: Bookmark },
      { href: "/playbooks", label: "Playbooks", icon: Library },
    ],
  },
  {
    group: "Ship",
    items: [
      { href: "/studio", label: "Studio", icon: Clapperboard, soon: "Phase 2" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, soon: "Phase 3" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, soon: "Phase 4" },
      { href: "/accounts", label: "Accounts", icon: Link2, soon: "Phase 5" },
    ],
  },
  {
    group: "",
    items: [{ href: "/settings", label: "Settings & backup", icon: Settings }],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);
