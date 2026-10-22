// Stands in for next/link in the single-page build.
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useRoute } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, onClick, prefetch, ...rest }, ref) {
  void prefetch;
  const go = useRoute((s) => s.go);
  return (
    <a
      ref={ref}
      {...rest}
      href={`#${href === "/" ? "today" : href.replace(/^\//, "")}`}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        go(href);
      }}
    />
  );
});

export default Link;
