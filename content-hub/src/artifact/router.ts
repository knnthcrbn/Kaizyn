import { create } from "zustand";
import { ALL_NAV } from "@/lib/nav";

// In-page navigation for the claude.ai-hosted copy, which is a single page
// with no server to answer /pipeline, /voice and so on.

const known = new Set(ALL_NAV.map((n) => n.href));

/** "#pipeline" on the artifact link opens that screen. */
function pathFromHash() {
  if (typeof window === "undefined") return "/";
  const token = window.location.hash.replace(/^#/, "");
  const path = token && token !== "today" ? `/${token}` : "/";
  return known.has(path) ? path : "/";
}

export const useRoute = create<{ path: string; go: (href: string) => void }>((set) => ({
  path: pathFromHash(),
  go: (href) => {
    const path = href.split(/[?#]/)[0] || "/";
    set({ path: known.has(path) ? path : "/" });
    document.querySelector("main")?.scrollTo({ top: 0 });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => useRoute.setState({ path: pathFromHash() }));
}
