/** The Content Hub mark: a rising line, drawn on the brand-purple tile. */
export function BrandMark({ className, stroke = "#0b0b0c" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M3 11.5 6.5 4l3 5 1.5-2.5L13 11.5" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
