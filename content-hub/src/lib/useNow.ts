"use client";

import { useEffect, useState } from "react";

/**
 * The time, for screens that show what's due: read once when the screen opens
 * and again every minute, so "posting now" moves on by itself without the
 * render reading the clock.
 */
export function useNow(every = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}
