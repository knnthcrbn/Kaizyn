import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clapperboard,
  FolderOpen,
  Bookmark,
  Home,
  KanbanSquare,
  Lightbulb,
  Link2,
  Magnet,
  Mic,
  Network,
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
      { href: "/chat", label: "Claude", icon: Sparkles },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/ideas", label: "Ideas", icon: Lightbulb },
    ],
  },
  {
    group: "Write",
    items: [
      { href: "/voice", label: "Voice Lab", icon: Mic },
      { href: "/hooks", label: "Hooks & overlays", icon: Magnet },
      { href: "/stories", label: "Story bank", icon: BookOpen },
      { href: "/swipe", label: "Swipe file", icon: Bookmark },
      { href: "/playbooks", label: "Playbooks", icon: Library },
    ],
  },
  {
    group: "Ship",
    items: [
      { href: "/library", label: "Footage", icon: FolderOpen },
      { href: "/studio", label: "Studio", icon: Clapperboard },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/accounts", label: "Accounts", icon: Link2 },
      { href: "/clipping", label: "Clipping", icon: Network },
    ],
  },
  {
    group: "",
    items: [{ href: "/settings", label: "Settings & backup", icon: Settings }],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);

/** "Pipeline screen": how Claude is told where the creator is in the hub. */
export function pageName(pathname: string) {
  const n = ALL_NAV.find((x) => (x.href === "/" ? pathname === "/" : pathname.startsWith(x.href)));
  return n ? `${n.label} screen` : pathname;
}
