// Stands in for next/navigation in the single-page build.
import { useRoute } from "../router";

export function usePathname() {
  return useRoute((s) => s.path);
}

export function useRouter() {
  const go = useRoute((s) => s.go);
  return { push: go, replace: go, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} };
}
